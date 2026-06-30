import browser from 'webextension-polyfill';
import { updateCurrentActiveTab, isValidUrl, isBlankPage, isNormalPageUrl, isAllowedByDomainFilter } from './utils/active-tab-manager';
import { TextHighlightData } from './utils/highlighter';
import { debounce } from './utils/debounce';
import { Settings } from './types/types';
import { debugLog } from './utils/debug';
import { loadSettings, generalSettings } from './utils/storage-utils';
import { sendToLLM } from './utils/interpreter';
import { formatTimeOnPage } from './utils/shared';
import { summarize, isSummarizerSupported, getSummarizerAvailability } from './utils/summarizer';
import { getEffectiveLanguage } from './utils/i18n';

const YOUTUBE_EMBED_RULE_ID = 9001;
const YOUTUBE_INNERTUBE_RULE_ID = 9002;

// Chrome: declarativeNetRequest to rewrite Referer on YouTube embeds.
async function enableYouTubeEmbedRule(tabId: number): Promise<void> {
	await chrome.declarativeNetRequest.updateSessionRules({
		removeRuleIds: [YOUTUBE_EMBED_RULE_ID],
		addRules: [{
			id: YOUTUBE_EMBED_RULE_ID,
			priority: 1,
			action: {
				type: 'modifyHeaders' as any,
				requestHeaders: [{
					header: 'Referer',
					operation: 'set' as any,
					value: 'https://obsidian.md/'
				}]
			},
			condition: {
				urlFilter: '||youtube.com/embed/',
				resourceTypes: ['sub_frame' as any],
				tabIds: [tabId]
			}
		}]
	});
}

async function disableYouTubeEmbedRule(): Promise<void> {
	await chrome.declarativeNetRequest.updateSessionRules({
		removeRuleIds: [YOUTUBE_EMBED_RULE_ID]
	});
}

// Set Origin header on YouTube innertube API requests from the extension.
// YouTube doesn't accept chrome-extension://...
async function enableYouTubeInnertubeRule(): Promise<void> {
	const dnr = (typeof chrome !== 'undefined' && chrome.declarativeNetRequest)
		|| (typeof browser !== 'undefined' && (browser as any).declarativeNetRequest);
	if (!dnr) return;
	try {
		await dnr.updateSessionRules({
			removeRuleIds: [YOUTUBE_INNERTUBE_RULE_ID],
			addRules: [{
				id: YOUTUBE_INNERTUBE_RULE_ID,
				priority: 1,
				action: {
					type: 'modifyHeaders' as any,
					requestHeaders: [
						{ header: 'Origin', operation: 'set' as any, value: 'https://www.youtube.com' },
						{ header: 'Referer', operation: 'set' as any, value: 'https://www.youtube.com/' },
					]
				},
				condition: {
					urlFilter: '||youtube.com/youtubei/',
					resourceTypes: ['xmlhttprequest' as any],
					initiatorDomains: [chrome?.runtime?.id || ''].filter(Boolean),
				}
			}]
		});
	} catch { /* Firefox/Safari use webRequest or native messaging instead */ }
}

// Firefox/Safari: use webRequest.onBeforeSendHeaders to set Origin/Referer on
// YouTube innertube requests. Fallback for browsers where declarativeNetRequest
// doesn't work or isn't supported.
if (typeof browser !== 'undefined' && browser.webRequest?.onBeforeSendHeaders) {
	try {
		browser.webRequest.onBeforeSendHeaders.addListener(
			(details) => {
				// Only modify requests from tabs showing extension pages
				if (details.tabId && details.tabId > 0) {
					// Check asynchronously would be complex — instead check
					// if the request has an extension origin or referer
					const refHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === 'referer');
					const refValue = refHeader?.value || '';
					const originHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === 'origin');
					const originValue = originHeader?.value || '';
					const isFromExtension = refValue.startsWith('moz-extension://') || originValue.startsWith('moz-extension://')
						|| refValue.startsWith('safari-web-extension://') || originValue.startsWith('safari-web-extension://');
					if (!isFromExtension) return { requestHeaders: details.requestHeaders };
				}

				const headers = details.requestHeaders || [];
				const setHeader = (name: string, value: string) => {
					const existing = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
					if (existing) {
						existing.value = value;
					} else {
						headers.push({ name, value });
					}
				};
				setHeader('Origin', 'https://www.youtube.com');
				setHeader('Referer', 'https://www.youtube.com/');
				return { requestHeaders: headers };
			},
			{ urls: ['*://www.youtube.com/*'] },
			['blocking', 'requestHeaders']
		);
	} catch { /* webRequest not available */ }
}

let highlighterModeState: { [tabId: number]: boolean } = {};
let hasHighlights = false;
let isContextMenuCreating = false;
let popupPorts: { [tabId: number]: browser.Runtime.Port } = {};

interface AutoSaveContent {
	markdown: string;
	title: string;
	url: string;
	author: string;
	description: string;
	published: string;
	timeOnPage?: number;
	tabId?: number;
	windowId?: number;
}

let autoSaveCache: { tabId: number; content: AutoSaveContent } | null = null;
let pendingTimeOnPage: { tabId: number; seconds: number } | null = null;

// Pre-generated summaries live in a SINGLE storage.local map keyed by URL, so reads
// and pruning touch only this one key instead of scanning the whole storage area
// (which can hold large blobs like `highlights`). They survive tab switches (which
// overwrite the single-slot autoSaveCache) and service-worker restarts.
// Shape: { [url]: { s, t } }.
const SUMMARIES_KEY = 'autoSaveSummaries';
const LEGACY_SUMMARY_PREFIX = 'summary:'; // obsolete per-URL keys from earlier builds
const SUMMARY_MAX_ENTRIES = 50;
const SUMMARY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface StoredSummary { s: string; t: number }
type SummariesMap = Record<string, StoredSummary>;

// Compare URLs ignoring the #fragment: same-document hash changes are not a real
// navigation away from the page.
function stripHash(url: string): string {
	const i = url.indexOf('#');
	return i === -1 ? url : url.slice(0, i);
}

// Summaries currently being generated, keyed by URL. Lets concurrent triggers
// (and the save path) await an in-flight generation instead of starting a new one.
const summaryInFlight = new Map<string, Promise<string | undefined>>();

// Serialize read-modify-write of the summaries map so concurrent stores/removes
// (e.g. summaries for different tabs finishing at the same time) don't clobber each
// other. All writes happen in this single service worker, so an in-memory chain
// is sufficient.
let summariesWriteChain: Promise<unknown> = Promise.resolve();
function withSummariesLock<T>(fn: () => Promise<T>): Promise<T> {
	const run = summariesWriteChain.then(fn, fn);
	summariesWriteChain = run.catch(() => {});
	return run as Promise<T>;
}

async function readSummaries(): Promise<SummariesMap> {
	const stored = await browser.storage.local.get(SUMMARIES_KEY);
	return (stored[SUMMARIES_KEY] as SummariesMap) ?? {};
}

// Drop entries older than the TTL, then cap to the most recent N.
function pruneSummariesMap(map: SummariesMap): SummariesMap {
	const now = Date.now();
	let entries = Object.entries(map).filter(([, v]) => now - (v?.t ?? 0) <= SUMMARY_TTL_MS);
	if (entries.length > SUMMARY_MAX_ENTRIES) {
		entries = entries.sort((a, b) => b[1].t - a[1].t).slice(0, SUMMARY_MAX_ENTRIES);
	}
	return Object.fromEntries(entries);
}

// Persist a freshly generated summary. Empty summaries are intentionally not stored
// so a later trigger can retry.
async function storeSummary(url: string, summary: string): Promise<void> {
	await withSummariesLock(async () => {
		const map = await readSummaries();
		map[url] = { s: summary, t: Date.now() };
		await browser.storage.local.set({ [SUMMARIES_KEY]: pruneSummariesMap(map) });
	});
}

async function getStoredSummary(url: string): Promise<string | undefined> {
	const map = await readSummaries();
	return map[url]?.s;
}

async function removeStoredSummary(url: string): Promise<void> {
	await withSummariesLock(async () => {
		const map = await readSummaries();
		if (url in map) {
			delete map[url];
			await browser.storage.local.set({ [SUMMARIES_KEY]: map });
		}
	});
}

// One-time cleanup of the obsolete per-URL `summary:<url>` keys written by earlier
// builds. Runs once (guarded by a flag); the single get(null) here is acceptable as
// it only ever happens on the first startup after this change ships.
async function cleanupLegacySummaryKeys(): Promise<void> {
	try {
		const { autoSaveSummariesMigrated } = await browser.storage.local.get('autoSaveSummariesMigrated');
		if (autoSaveSummariesMigrated) return;
		const all = await browser.storage.local.get(null);
		const legacy = Object.keys(all).filter(k => k.startsWith(LEGACY_SUMMARY_PREFIX));
		if (legacy.length > 0) await browser.storage.local.remove(legacy);
		await browser.storage.local.set({ autoSaveSummariesMigrated: true });
	} catch (err) {
		console.log('[AutoSave] legacy summary cleanup error:', err);
	}
}

// Service-worker keep-alive: while a save is awaiting a (possibly slow) summary,
// ping a side-effect-free extension API periodically so MV3 doesn't tear the
// worker down before the file write completes. Reference-counted for nesting.
let keepAliveRefCount = 0;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function startKeepAlive(): void {
	keepAliveRefCount++;
	if (keepAliveTimer === null) {
		keepAliveTimer = setInterval(() => {
			// Any extension API event resets the MV3 idle timer.
			chrome.runtime.getPlatformInfo().catch(() => {});
		}, 20000);
	}
}

function stopKeepAlive(): void {
	keepAliveRefCount = Math.max(0, keepAliveRefCount - 1);
	if (keepAliveRefCount === 0 && keepAliveTimer !== null) {
		clearInterval(keepAliveTimer);
		keepAliveTimer = null;
	}
}

// Kick off summary generation for a page during reading time (load-complete), so
// the result is ready and persisted before the save trigger fires. No-op if a
// summary already exists or is already being generated for this URL.
async function precomputeSummary(url: string, markdown: string, title: string): Promise<void> {
	if (summaryInFlight.has(url)) return;
	if (await getStoredSummary(url)) return;
	const promise = generateSummaryInBackground(markdown, title)
		.then(async summary => {
			if (summary?.trim()) {
				await storeSummary(url, summary);
			}
			return summary;
		})
		.catch(err => {
			console.log('[AutoSave] precomputeSummary error:', err);
			return undefined;
		})
		.finally(() => {
			summaryInFlight.delete(url);
		});
	summaryInFlight.set(url, promise);
}

async function generateSummaryInBackground(markdown: string, title: string): Promise<string | undefined> {
	const startedAt = Date.now();
	console.log('[AutoSave] Summary started:', title);
	const elapsed = () => `${Date.now() - startedAt}ms`;
	const settings = await loadSettings();
	// Try the configured LLM first, but only when it is fully set up.
	if (settings.interpreterEnabled && settings.summaryPrompt?.trim()) {
		const modelConfig = generalSettings.models.find(m => m.id === settings.interpreterModel);
		if (modelConfig) {
			const provider = generalSettings.providers.find(p => p.id === modelConfig.providerId);
			try {
				const { promptResponses } = await sendToLLM(
					markdown,
					'',
					[{ key: '__summary__', prompt: settings.summaryPrompt }],
					modelConfig
				);
				const response = promptResponses.find((r: { key: string }) => r.key === '__summary__');
				const summary = response?.user_response as string | undefined;
				if (summary?.trim()) {
					console.log(`[AutoSave] Summary completed via LLM (${modelConfig.name}) in ${elapsed()}`);
					return summary;
				}
			} catch (err) {
				console.warn(`[AutoSave] LLM summary failed (provider: ${provider?.name}, model: ${modelConfig.name}), falling back to Summarizer:`, err);
			}
		}
	}
	// Fallback: Chrome's built-in on-device Summarizer (when LLM is unset or failed).
	// Runs directly in the background, like the reference implementation. Only used
	// when the model is actually usable; if availability() is not 'available', or
	// create()/summarize() throws (e.g. the on-device model can't run on this
	// device), we skip and save without a summary rather than failing.
	try {
		if (isSummarizerSupported()) {
			const { code } = await getEffectiveLanguage();
			const availability = await getSummarizerAvailability(code);
			if (availability === 'available') {
				const summary = await summarize(title, markdown, code);
				if (summary.trim()) {
					console.log(`[AutoSave] Summary completed via on-device Summarizer (${code}) in ${elapsed()}`);
					return summary;
				}
			}
		}
	} catch (err) {
		console.warn('[AutoSave] Summarizer fallback failed:', err);
	}
	console.log(`[AutoSave] Summary completed with no result in ${elapsed()}`);
	return undefined;
}

function buildAutoSaveFrontmatter(c: AutoSaveContent, summary?: string): string {
	const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	const fields: [string, string][] = [
		['title', c.title],
		['source', c.url],
		['author', c.author],
		['created', new Date().toISOString()],
		['description', c.description],
		['published', c.published],
	];
	const lines = fields.filter(([, v]) => v).map(([k, v]) => `${k}: "${esc(v)}"`);
	lines.push(`visit_duration: "${esc(formatTimeOnPage(c.timeOnPage ?? 0))}"`);
	if (c.tabId !== undefined) lines.push(`tab_id: "${c.tabId}"`);
	if (c.windowId !== undefined) lines.push(`window_id: "${c.windowId}"`);
	lines.push(`summary: "${esc(summary || '')}"`);
	return `---\n${lines.join('\n')}\n---\n`;
}

function buildAutoSaveFileName(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
	return `${ts}.md`;
}

async function extractAndCache(tabId: number, precompute = false): Promise<void> {
	try {
		const settings = await loadSettings();
		if (!settings.autoSaveEnabled) {
			return;
		}
		const tab = await browser.tabs.get(tabId);
		if (!tab.url || !isValidUrl(tab.url) || isBlankPage(tab.url)) {
			return;
		}
		// NOTE: the domain filter is intentionally NOT checked here. It is checked
		// at save time in saveIfCached() instead, so that updating the filter after
		// a page was already visited/cached is honored (e.g. removing a domain from
		// the filter still allows the already-open page to be saved).
		await ensureContentScriptLoadedInBackground(tabId);
		const response = await browser.tabs.sendMessage(tabId, { action: 'getMarkdownContent' }) as AutoSaveContent & { success: boolean };
		if (response?.success) {
			response.tabId = tabId;
			response.windowId = tab.windowId;
			autoSaveCache = { tabId, content: response };
			// On page load, pre-generate the summary in the background so it is ready
			// (and persisted by URL) before the save trigger. Skip domain-filtered
			// pages to avoid wasting LLM calls / hitting the rate-limit cooldown.
			if (precompute && isAllowedByDomainFilter(response.url, settings.domainFilter)) {
				void precomputeSummary(response.url, response.markdown, response.title);
			}
		} else {
			console.log('[AutoSave] getMarkdownContent failed:', response);
		}
	} catch (err) {
		console.log('[AutoSave] extractAndCache error:', err);
	}
}

async function saveIfCached(tabId: number): Promise<void> {
	if (!autoSaveCache || autoSaveCache.tabId !== tabId) return;
	const { content } = autoSaveCache;
	autoSaveCache = null;
	if (pendingTimeOnPage?.tabId === tabId) {
		content.timeOnPage = pendingTimeOnPage.seconds;
		pendingTimeOnPage = null;
	}
	// Keep the service worker alive across the (possibly slow) summary wait and the
	// file write, so a save triggered on navigation/tab-close isn't lost to teardown.
	startKeepAlive();
	try {
		// Re-check the domain filter at save time: the user may have added this
		// domain to the filter after the page was already visited/cached.
		// This must run before LLM summarization and the file save so both are skipped.
		const settings = await loadSettings();
		if (!settings.autoSaveEnabled) {
			return;
		}
		if (!isAllowedByDomainFilter(content.url, settings.domainFilter)) {
			await removeStoredSummary(content.url);
			return;
		}
		// Prefer the pre-generated summary persisted at load time. If none is stored
		// but one is still being generated, wait for it. Otherwise generate inline.
		// In the first two cases the summary may be persisted in the map, so remove it.
		let summary = await getStoredSummary(content.url);
		if (summary) {
			await removeStoredSummary(content.url);
		} else if (summaryInFlight.has(content.url)) {
			summary = await summaryInFlight.get(content.url);
			await removeStoredSummary(content.url);
		} else {
			summary = await generateSummaryInBackground(content.markdown, content.title);
		}
		const fileContent = buildAutoSaveFrontmatter(content, summary) + content.markdown;
		const fileName = buildAutoSaveFileName();
		await ensureOffscreenDocument();
		const result = await chrome.runtime.sendMessage({
			action: 'offscreen-saveFile',
			target: 'offscreen',
			fileName,
			content: fileContent,
		}) as { success: boolean; error?: string; needsPermission?: boolean };
		if (result?.success) {
			console.log('[AutoSave] Saved:', fileName);
			chrome.action.setBadgeText({ text: '' });
			const msg = `Saved: ${content.title || fileName}`;
			browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
				const tabId = tabs[0]?.id;
				if (tabId) browser.tabs.sendMessage(tabId, { action: 'showToast', message: msg }).catch(() => {});
			});
		} else if (result?.error === 'no-handle') {
			console.warn('[AutoSave] Save failed: no save directory configured');
			chrome.action.setBadgeText({ text: '!' });
			chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
			chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
		} else if (result?.needsPermission) {
			console.warn(`[AutoSave] Save failed: directory permission not granted (file: ${fileName})`);
			chrome.action.setBadgeText({ text: '!' });
			chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
			await chrome.storage.local.set({ autoSaveNeedsPermission: true });
			chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
		} else {
			console.warn('[AutoSave] Save failed:', result?.error);
		}
	} catch (err) {
		console.log('[AutoSave] Error during save:', err);
	} finally {
		stopKeepAlive();
	}
}

async function injectContentScript(tabId: number): Promise<void> {
	if (browser.scripting) {
		debugLog('Clipper', 'Using scripting API');
		await browser.scripting.executeScript({
			target: { tabId },
			files: ['content.js']
		});
	} else {
		debugLog('Clipper', 'Using tabs.executeScript fallback');
		await browser.tabs.executeScript(tabId, { file: 'content.js' });
	}
	debugLog('Clipper', 'Injection completed, waiting for init...');

	// Poll until the content script responds, rather than a fixed delay.
	// Try immediately after injection, then back off with 50ms sleeps.
	let ready = false;
	for (let i = 0; i < 8; i++) {
		try {
			await browser.tabs.sendMessage(tabId, { action: "ping" });
			ready = true;
			break;
		} catch {
			// Not ready yet
		}
		await new Promise(resolve => setTimeout(resolve, 50));
	}
	if (!ready) {
		throw new Error('Content script did not respond after injection');
	}
	debugLog('Clipper', 'Post-injection ping succeeded');
}

async function ensureContentScriptLoadedInBackground(tabId: number): Promise<void> {
	try {
		// First, get the tab information
		const tab = await browser.tabs.get(tabId);

		// Check if the URL is valid before proceeding
		if (!tab.url || !isValidUrl(tab.url)) {
			throw new Error('Invalid URL for content script injection');
		}

		// Attempt to send a message to the content script
		await browser.tabs.sendMessage(tabId, { action: "ping" });
		debugLog('Clipper', 'Content script ping succeeded');
	} catch (error) {
		// If the error is about invalid URL, re-throw it
		if (error instanceof Error && error.message.includes('invalid URL')) {
			throw error;
		}

		// If the message fails, the content script is not loaded, so inject it
		debugLog('Clipper', 'Ping failed, injecting content script...', error);
		await injectContentScript(tabId);
	}
}

// Route a message to a tab, handling both normal pages (via content script)
// and extension pages (via runtime.sendMessage forwarding).
async function routeMessageToTab(tabId: number, message: any): Promise<any> {
	const tab = await browser.tabs.get(tabId);
	if (isNormalPageUrl(tab.url)) {
		await ensureContentScriptLoadedInBackground(tabId);
		return browser.tabs.sendMessage(tabId, message);
	} else {
		return browser.runtime.sendMessage({
			action: 'extensionPageMessage',
			targetTabId: tabId,
			message
		});
	}
}

function getHighlighterModeForTab(tabId: number): boolean {
	return highlighterModeState[tabId] ?? false;
}

const OFFSCREEN_URL = 'offscreen.html';

async function ensureOffscreenDocument(): Promise<void> {
	const existingContexts = await (chrome.runtime as any).getContexts({
		contextTypes: ['OFFSCREEN_DOCUMENT'],
		documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
	});
	if (existingContexts.length > 0) return;
	await (chrome as any).offscreen.createDocument({
		url: OFFSCREEN_URL,
		reasons: ['BLOBS'],
		justification: 'Write files to a user-selected directory via File System Access API'
	});
}

// Proactively detect a lapsed directory permission (e.g. after a browser restart,
// when the File System Access handle loses its read-write grant). Re-granting needs
// a user gesture and can't happen during background auto-save, so we surface it early
// — once per browser session — instead of silently failing at the save trigger.
async function probeAutoSavePermission(): Promise<void> {
	try {
		const settings = await loadSettings();
		if (!settings.autoSaveEnabled) return;
		await ensureOffscreenDocument();
		const res = await chrome.runtime.sendMessage({
			action: 'offscreen-checkPermission',
			target: 'offscreen',
		}) as { hasHandle: boolean; granted: boolean };
		if (!res?.hasHandle || res.granted) return;

		console.warn('[AutoSave] Directory permission not granted; prompting user to re-grant');
		chrome.action.setBadgeText({ text: '!' });
		chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
		await chrome.storage.local.set({ autoSaveNeedsPermission: true });

		// Open the settings page once per browser session so the user isn't nagged on
		// every service-worker restart. storage.session is cleared on browser restart
		// and on extension reload, which is exactly when permission can lapse.
		const { autoSavePermissionPrompted } = await chrome.storage.session.get('autoSavePermissionPrompted');
		if (!autoSavePermissionPrompted) {
			await chrome.storage.session.set({ autoSavePermissionPrompted: true });
			chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
		}
	} catch (err) {
		console.log('[AutoSave] permission probe error:', err);
	}
}

async function initialize() {
	try {
		// Keep offscreen document alive for reliable auto-save on tab close
		await ensureOffscreenDocument();

		// Surface a lapsed directory permission early, before any save trigger.
		await probeAutoSavePermission();

		// One-time sweep of obsolete per-URL summary keys from earlier builds.
		await cleanupLegacySummaryKeys();

		// Set up tab listeners
		await setupTabListeners();

		// Cache the already-active tab (onActivated doesn't fire for it at startup)
		const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
		if (activeTabs[0]?.id) {
			extractAndCache(activeTabs[0].id);
			updateActionIconForTab(activeTabs[0].id, activeTabs[0].url);
		}

		browser.tabs.onRemoved.addListener((tabId) => {
			saveIfCached(tabId);
			delete highlighterModeState[tabId];
		});
		
		// Initialize context menu
		await debouncedUpdateContextMenu(-1);

		// Enable Origin header for YouTube innertube API requests
		await enableYouTubeInnertubeRule();

		// Set up action popup based on openBehavior setting
		await updateActionPopup();

		debugLog('Clipper', 'Background script initialized successfully');
	} catch (error) {
		console.error('Error initializing background script:', error);
	}
}

// Check if a popup is open for a given tab
function isPopupOpen(tabId: number): boolean {
	return popupPorts.hasOwnProperty(tabId);
}

browser.runtime.onConnect.addListener((port) => {
	if (port.name === 'popup') {
		const tabId = port.sender?.tab?.id;
		if (tabId) {
			popupPorts[tabId] = port;
			port.onDisconnect.addListener(() => {
				delete popupPorts[tabId];
			});
		}
	}
});

async function sendMessageToPopup(tabId: number, message: any): Promise<void> {
	if (isPopupOpen(tabId)) {
		try {
			await popupPorts[tabId].postMessage(message);
		} catch (error) {
			console.warn(`Error sending message to popup for tab ${tabId}:`, error);
		}
	}
}



// Safari: route fetch through native messaging (URLSession in Swift).
// Called from the background script where sendNativeMessage works reliably.
async function nativeFetch(url: string, options?: any): Promise<{ ok: boolean; status: number; text: string; error?: string }> {
	try {
		const result = await browser.runtime.sendNativeMessage('application.id', {
			type: 'fetchRequest',
			url,
			method: options?.method || 'GET',
			headers: options?.headers || {},
			body: options?.body || null,
		}) as { ok: boolean; status: number; text: string; error?: string };
		return result || { ok: false, status: 0, text: '', error: 'Empty native response' };
	} catch (err) {
		return { ok: false, status: 0, text: '', error: (err as Error).message };
	}
}

// Fetch proxy for extension pages.
// Returns a Promise for the webextension-polyfill.
// On Firefox MV3, host_permissions require explicit user grant —
// callers detect CORS_PERMISSION_NEEDED and prompt via permissions.request().
browser.runtime.onMessage.addListener((request: unknown) => {
	if (typeof request !== 'object' || request === null) return;
	if ((request as any).action !== 'fetchProxy') return;
	const { url, options } = request as { url: string; options?: any };
	const fetchOptions: RequestInit = {};
	if (options?.method) fetchOptions.method = options.method;
	if (options?.headers) fetchOptions.headers = options.headers;
	if (options?.body) fetchOptions.body = options.body;
	return fetch(url, fetchOptions)
		.then(async (resp) => {
			const text = await resp.text();
			// If YouTube returns bot-detection HTML, try native messaging (Safari)
			if (!resp.ok && (text.includes('Sorry') || text.includes('<html')) && typeof browser.runtime.sendNativeMessage === 'function') {
				return nativeFetch(url, options);
			}
			return { ok: resp.ok, status: resp.status, text, finalUrl: resp.url };
		})
		.catch(async () => {
			// CORS failure — try native messaging (Safari), else report permission needed
			if (typeof browser.runtime.sendNativeMessage === 'function') {
				return nativeFetch(url, options);
			}
			return { ok: false, status: 0, text: '', error: 'CORS_PERMISSION_NEEDED' };
		});
});

browser.runtime.onMessage.addListener((request: unknown, sender: browser.Runtime.MessageSender, sendResponse: (response?: any) => void): true | undefined => {
	if (typeof request === 'object' && request !== null) {
		const typedRequest = request as { action: string; isActive?: boolean; hasHighlights?: boolean; tabId?: number; text?: string; section?: string; readerUrl?: string; message?: string };

		if (typedRequest.action === 'updateTimeOnPage') {
			const tabId = sender.tab?.id;
			if (tabId !== undefined && (typedRequest as any).timeOnPage !== undefined) {
				pendingTimeOnPage = { tabId, seconds: (typedRequest as any).timeOnPage };
			}
			return;
		}

		if (typedRequest.action === 'showNotification') {
			const msg = `Saved: ${typedRequest.message || ''}`;
			browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
				const tabId = tabs[0]?.id;
				if (tabId) browser.tabs.sendMessage(tabId, { action: 'showToast', message: msg });
			});
			return;
		}

		if (typedRequest.action === 'copy-to-clipboard' && typedRequest.text) {
			// Use content script to copy to clipboard
			browser.tabs.query({active: true, currentWindow: true}).then(async (tabs) => {
				const currentTab = tabs[0];
				if (currentTab && currentTab.id) {
					try {
						const response = await browser.tabs.sendMessage(currentTab.id, {
							action: 'copy-text-to-clipboard',
							text: typedRequest.text
						});
						if ((response as any) && (response as any).success) {
							sendResponse({success: true});
						} else {
							sendResponse({success: false, error: 'Failed to copy from content script'});
						}
					} catch (err) {
						sendResponse({ success: false, error: (err as Error).message });
					}
				} else {
					sendResponse({success: false, error: 'No active tab found'});
				}
			});
			return true;
		}

		// fetchProxy is handled by a separate listener below

		if (typedRequest.action === "extractContent" && sender.tab && sender.tab.id) {
			browser.tabs.sendMessage(sender.tab.id, request).then(sendResponse);
			return true;
		}

		if (typedRequest.action === "ensureContentScriptLoaded") {
			const tabId = typedRequest.tabId || sender.tab?.id;
			if (tabId) {
				ensureContentScriptLoadedInBackground(tabId)
					.then(() => sendResponse({ success: true }))
					.catch((error) => sendResponse({ 
						success: false, 
						error: error instanceof Error ? error.message : String(error) 
					}));
				return true;
			} else {
				sendResponse({ success: false, error: 'No tab ID provided' });
				return true;
			}
		}

		if (typedRequest.action === 'saveToDirectory') {
				const { fileName, content } = typedRequest as any;
				ensureOffscreenDocument()
					.then(() => chrome.runtime.sendMessage({ action: 'offscreen-saveFile', target: 'offscreen', fileName, content }))
					.then(result => sendResponse(result))
					.catch(err => sendResponse({ success: false, error: (err as Error).message }));
				return true;
			}

			if (typedRequest.action === "enableYouTubeEmbedRule") {
			const tabId = sender.tab?.id;
			if (tabId) {
				enableYouTubeEmbedRule(tabId).then(() => {
					sendResponse({ success: true });
				}).catch(() => {
					sendResponse({ success: true });
				});
			} else {
				sendResponse({ success: true });
			}
			return true;
		}

		if (typedRequest.action === "disableYouTubeEmbedRule") {
			disableYouTubeEmbedRule().then(() => {
				sendResponse({ success: true });
			}).catch(() => {
				sendResponse({ success: true });
			});
			return true;
		}

		if (typedRequest.action === "highlighterModeChanged" && sender.tab && typedRequest.isActive !== undefined) {
			const tabId = sender.tab.id;
			if (tabId) {
				highlighterModeState[tabId] = typedRequest.isActive;
				sendMessageToPopup(tabId, { action: "updatePopupHighlighterUI", isActive: typedRequest.isActive });
				debouncedUpdateContextMenu(tabId);
			}
		}

		if (typedRequest.action === "highlightsCleared" && sender.tab) {
			hasHighlights = false;
			debouncedUpdateContextMenu(sender.tab.id!);
		}

		if (typedRequest.action === "updateHasHighlights" && sender.tab && typedRequest.hasHighlights !== undefined) {
			hasHighlights = typedRequest.hasHighlights;
			debouncedUpdateContextMenu(sender.tab.id!);
		}

		if (typedRequest.action === "getHighlighterMode") {
			const tabId = typedRequest.tabId || sender.tab?.id;
			if (tabId) {
				sendResponse({ isActive: getHighlighterModeForTab(tabId) });
			} else {
				sendResponse({ isActive: false });
			}
			return true;
		}

		if (typedRequest.action === "toggleHighlighterMode" && typedRequest.tabId) {
			toggleHighlighterMode(typedRequest.tabId)
				.then(newMode => sendResponse({ success: true, isActive: newMode }))
				.catch(error => sendResponse({ success: false, error: error.message }));
			return true;
		}

		if (typedRequest.action === "openPopup") {
			openPopup()
				.then(() => {
					sendResponse({ success: true });
				})
				.catch((error: unknown) => {
					console.error('Error opening popup in background script:', error);
					sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
				});
			return true;
		}

		if (typedRequest.action === "getActiveTab") {
			browser.tabs.query({active: true, currentWindow: true}).then(async (tabs) => {
				let currentTab = tabs[0];
				// Fallback for when currentWindow has no tabs (e.g., debugging popup in DevTools)
				if (!currentTab || !currentTab.id) {
					const allActiveTabs = await browser.tabs.query({active: true});
					currentTab = allActiveTabs.find(tab =>
						tab.id && tab.url && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('moz-extension://')
					) || allActiveTabs[0];
				}
				if (currentTab && currentTab.id) {
					sendResponse({tabId: currentTab.id});
				} else {
					sendResponse({error: 'No active tab found'});
				}
			});
			return true;
		}

		if (typedRequest.action === "openOptionsPage") {
			try {
				if (typeof browser.runtime.openOptionsPage === 'function') {
					// Chrome way
					browser.runtime.openOptionsPage();
				} else {
					// Firefox way
					browser.tabs.create({
						url: browser.runtime.getURL('settings.html')
					});
				}
				sendResponse({success: true});
			} catch (error) {
				console.error('Error opening options page:', error);
				sendResponse({success: false, error: error instanceof Error ? error.message : String(error)});
			}
			return true;
		}

		if (typedRequest.action === "openSettings") {
			try {
				const section = typedRequest.section ? `?section=${typedRequest.section}` : '';
				browser.tabs.create({
					url: browser.runtime.getURL(`settings.html${section}`)
				});
				sendResponse({success: true});
			} catch (error) {
				console.error('Error opening settings:', error);
				sendResponse({success: false, error: error instanceof Error ? error.message : String(error)});
			}
			return true;
		}

		if (typedRequest.action === "copyMarkdownToClipboard" || typedRequest.action === "saveMarkdownToFile") {
			if (sender.tab?.id) {
				routeMessageToTab(sender.tab.id, { action: typedRequest.action })
					.then(() => sendResponse({success: true}))
					.catch((error) => sendResponse({success: false, error: error instanceof Error ? error.message : String(error)}));
				return true;
			}
		}

		if (typedRequest.action === "getTabInfo") {
			browser.tabs.get(typedRequest.tabId as number).then((tab) => {
				sendResponse({
					success: true,
					tab: {
						id: tab.id,
						url: tab.url,
						windowId: tab.windowId
					}
				});
			}).catch((error) => {
				console.error('Error getting tab info:', error);
				sendResponse({
					success: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});
			return true;
		}

		if (typedRequest.action === "forceInjectContentScript") {
			const tabId = typedRequest.tabId;
			if (tabId) {
				injectContentScript(tabId)
					.then(() => sendResponse({ success: true }))
					.catch((error) => {
						console.error('[Obsidian Clipper] forceInjectContentScript failed:', error);
						sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
					});
				return true;
			} else {
				sendResponse({ success: false, error: 'Missing tabId' });
				return true;
			}
		}

		if (typedRequest.action === "sendMessageToTab") {
			const tabId = (typedRequest as any).tabId;
			const message = (typedRequest as any).message;
			if (tabId && message) {
				routeMessageToTab(tabId, message).then((response) => {
					sendResponse(response);
				}).catch((error) => {
					console.error('[Obsidian Clipper] Error sending message to tab:', error);
					sendResponse({
						success: false,
						error: error instanceof Error ? error.message : String(error)
					});
				});
				return true;
			} else {
				sendResponse({
					success: false,
					error: 'Missing tabId or message'
				});
				return true;
			}
		}

		if (typedRequest.action === "openObsidianUrl") {
			const url = (typedRequest as any).url;
			if (url) {
				browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
					const currentTab = tabs[0];
					if (currentTab && currentTab.id) {
						browser.tabs.update(currentTab.id, { url: url }).then(() => {
							sendResponse({ success: true });
						}).catch((error) => {
							console.error('Error opening Obsidian URL:', error);
							sendResponse({
								success: false,
								error: error instanceof Error ? error.message : String(error)
							});
						});
					} else {
						sendResponse({
							success: false,
							error: 'No active tab found'
						});
					}
				}).catch((error) => {
					console.error('Error querying tabs:', error);
					sendResponse({
						success: false,
						error: error instanceof Error ? error.message : String(error)
					});
				});
				return true;
			} else {
				sendResponse({
					success: false,
					error: 'Missing URL'
				});
				return true;
			}
		}

		// For other actions that use sendResponse
		if (typedRequest.action === "extractContent" ||
			typedRequest.action === "ensureContentScriptLoaded" ||
			typedRequest.action === "getHighlighterMode" ||
			typedRequest.action === "toggleHighlighterMode" ||
			typedRequest.action === "openObsidianUrl") {
			return true;
		}
	}
	return undefined;
});

browser.commands.onCommand.addListener(async (command, tab) => {
	// Some browsers (e.g. Orion) don't pass the tab parameter, so fall back to querying
	if (!tab?.id) {
		const tabs = await browser.tabs.query({active: true, currentWindow: true});
		tab = tabs[0];
	}

	if (command === "copy_to_clipboard" && tab?.id) {
		await browser.tabs.sendMessage(tab.id, { action: "copyToClipboard" });
	}
});

const debouncedUpdateContextMenu = debounce(async (tabId: number) => {
	if (isContextMenuCreating) {
		return;
	}
	isContextMenuCreating = true;

	try {
		await browser.contextMenus.removeAll();

		let currentTabId = tabId;
		if (currentTabId === -1) {
			const tabs = await browser.tabs.query({ active: true, currentWindow: true });
			if (tabs.length > 0) {
				currentTabId = tabs[0].id!;
			}
		}

		const menuItems: {
			id: string;
			title: string;
			contexts: browser.Menus.ContextType[];
		}[] = [
				{
					id: 'copy-markdown-to-clipboard',
					title: browser.i18n.getMessage('copyToClipboard'),
					contexts: ["page", "selection"]
				}
			];

		for (const item of menuItems) {
			await browser.contextMenus.create(item);
		}
	} catch (error) {
		console.error('Error updating context menu:', error);
	} finally {
		isContextMenuCreating = false;
	}
}, 100); // 100ms debounce time

browser.contextMenus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId === 'copy-markdown-to-clipboard' && tab && tab.id) {
		await ensureContentScriptLoadedInBackground(tab.id);
		await browser.tabs.sendMessage(tab.id, { action: "copyMarkdownToClipboard" });
	}
});

browser.runtime.onInstalled.addListener(() => {
	debouncedUpdateContextMenu(-1); // Use a dummy tabId for initial creation
});


async function setupTabListeners() {
	// intentionally left empty — listeners are registered at top level below
}

// Gray out the toolbar icon (and set an explanatory tooltip) for tabs whose
// domain is excluded from auto-save by the domain filter. Per-tab via setIcon tabId.
async function updateActionIconForTab(tabId: number, url?: string): Promise<void> {
	try {
		if (!url) {
			const tab = await browser.tabs.get(tabId);
			url = tab.url;
		}
		const settings = await loadSettings();
		const blocked = !!url && isValidUrl(url) && !isAllowedByDomainFilter(url, settings.domainFilter);
		const suffix = blocked ? '-gray' : '';
		await chrome.action.setIcon({
			tabId,
			path: {
				16: `icons/icon16${suffix}.png`,
				48: `icons/icon48${suffix}.png`,
				128: `icons/icon128${suffix}.png`,
			},
		});
		await chrome.action.setTitle({
			tabId,
			title: blocked ? browser.i18n.getMessage('domainFilterBlockedTooltip') : '',
		});
	} catch {
		// tab may have closed; ignore
	}
}

// Register tab listeners at the top level so they survive service worker restarts.
browser.tabs.onActivated.addListener((activeInfo) => {
	handleTabChange(activeInfo);
	extractAndCache(activeInfo.tabId);
	updateActionIconForTab(activeInfo.tabId);
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status === 'loading' && changeInfo.url) {
		// Skip saving when the tab is merely reloading the SAME url rather than
		// navigating away. This covers Chrome auto-reloading a tab it discarded for
		// memory while idle (reactivation reloads the same URL) as well as a manual
		// refresh — in both cases the user is staying on the page, so we keep the
		// cached content (a later real navigation or tab close will still save it).
		const cachedUrl = autoSaveCache?.tabId === tabId ? autoSaveCache.content.url : undefined;
		const sameUrlReload = !!cachedUrl && stripHash(changeInfo.url) === stripHash(cachedUrl);
		if (!sameUrlReload) {
			if (autoSaveCache?.tabId === tabId) {
				try {
					const res = await browser.tabs.sendMessage(tabId, { action: 'getTimeOnPage' }) as { timeOnPage?: number };
					if (res?.timeOnPage !== undefined) {
						pendingTimeOnPage = { tabId, seconds: res.timeOnPage };
					}
				} catch {}
			}
			saveIfCached(tabId);
		}
	}
	if (changeInfo.status === 'complete') {
		handleTabChange({ tabId, windowId: tab.windowId });
		extractAndCache(tabId, true);
		updateActionIconForTab(tabId, tab.url);
	}
});

const debouncedPaintHighlights = debounce(async (tabId: number) => {
	if (!getHighlighterModeForTab(tabId)) {
		await setHighlighterMode(tabId, false);
	}
	await paintHighlights(tabId);
}, 250);

async function handleTabChange(activeInfo: { tabId: number; windowId?: number }) {
	if (activeInfo.windowId) {
		updateCurrentActiveTab(activeInfo.windowId);
	}
	await debouncedPaintHighlights(activeInfo.tabId);
}

async function paintHighlights(tabId: number) {
	try {
		const tab = await browser.tabs.get(tabId);
		if (!tab || !tab.url || !isValidUrl(tab.url) || isBlankPage(tab.url)) {
			return;
		}

		await ensureContentScriptLoadedInBackground(tabId);
		await browser.tabs.sendMessage(tabId, { action: "paintHighlights" });

	} catch (error) {
		console.error('Error painting highlights:', error);
	}
}

async function setHighlighterMode(tabId: number, activate: boolean) {
	try {
		// First, check if the tab exists
		const tab = await browser.tabs.get(tabId);
		if (!tab || !tab.url) {
			return;
		}

		// Check if the URL is valid and not a blank page
		if (!isValidUrl(tab.url) || isBlankPage(tab.url)) {
			return;
		}

		// Then, ensure the content script is loaded
		await ensureContentScriptLoadedInBackground(tabId);

		// Now try to send the message
		highlighterModeState[tabId] = activate;
		await browser.tabs.sendMessage(tabId, { action: "setHighlighterMode", isActive: activate });
		debouncedUpdateContextMenu(tabId);
		await sendMessageToPopup(tabId, { action: "updatePopupHighlighterUI", isActive: activate });

	} catch (error) {
		console.error('Error setting highlighter mode:', error);
		// If there's an error, assume highlighter mode should be off
		highlighterModeState[tabId] = false;
		debouncedUpdateContextMenu(tabId);
		await sendMessageToPopup(tabId, { action: "updatePopupHighlighterUI", isActive: false });
	}
}

async function toggleHighlighterMode(tabId: number): Promise<boolean> {
	try {
		const currentMode = getHighlighterModeForTab(tabId);
		const newMode = !currentMode;
		highlighterModeState[tabId] = newMode;
		await browser.tabs.sendMessage(tabId, { action: "setHighlighterMode", isActive: newMode });
		debouncedUpdateContextMenu(tabId);
		await sendMessageToPopup(tabId, { action: "updatePopupHighlighterUI", isActive: newMode });
		return newMode;
	} catch (error) {
		console.error('Error toggling highlighter mode:', error);
		throw error;
	}
}

async function highlightSelection(tabId: number, info: browser.Menus.OnClickData) {
	highlighterModeState[tabId] = true;
	
	const highlightData: Partial<TextHighlightData> = {
		id: Date.now().toString(),
		type: 'text',
		content: info.selectionText || '',
	};

	await browser.tabs.sendMessage(tabId, { 
		action: "highlightSelection", 
		isActive: true,
		highlightData,
	});
	hasHighlights = true;
	debouncedUpdateContextMenu(tabId);
}

async function highlightElement(tabId: number, info: browser.Menus.OnClickData) {
	highlighterModeState[tabId] = true;

	await browser.tabs.sendMessage(tabId, { 
		action: "highlightElement", 
		isActive: true,
		targetElementInfo: {
			mediaType: info.mediaType === 'image' ? 'img' : info.mediaType,
			srcUrl: info.srcUrl,
			pageUrl: info.pageUrl
		}
	});
	hasHighlights = true;
	debouncedUpdateContextMenu(tabId);
}

// The action always opens the popup page (the only remaining open behavior).
async function updateActionPopup(): Promise<void> {
	await browser.action.setPopup({ popup: 'popup.html' });
}

// Opens the browser action popup (used by the highlighter's open-popup message).
async function openPopup(): Promise<void> {
	await browser.action.openPopup();
}

browser.storage.onChanged.addListener(async (changes, area) => {
	if (area === 'sync' && changes.domainFilter) {
		// Re-evaluate the icon for the active tab of each window when the filter changes.
		const tabs = await browser.tabs.query({ active: true });
		for (const t of tabs) {
			if (t.id) updateActionIconForTab(t.id, t.url);
		}
	}
});

// Initialize the extension
initialize().catch(error => {
	console.error('Failed to initialize background script:', error);
});
