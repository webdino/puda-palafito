import browser from './utils/browser-polyfill';
import * as highlighter from './utils/highlighter';
import { removeExistingHighlights } from './utils/highlighter-overlays';
import { loadSettings, generalSettings } from './utils/storage-utils';
import { getDomain } from './utils/string-utils';
import { extractContentBySelector as extractContentBySelectorShared } from './utils/shared';
import Defuddle from 'defuddle';
import { createMarkdownContent } from 'defuddle/full';
import { flattenShadowDom } from './utils/flatten-shadow-dom';
import { serializeChildren } from './utils/dom-utils';
import { saveFile } from './utils/file-utils';
import { debugLog } from './utils/debug';
import { parseForClip } from './utils/clip-utils';

declare global {
	interface Window {
		obsidianClipperGeneration?: number;
	}
}

// IIFE to scope variables and allow safe re-execution
(function() {
	// Bump the generation counter on every injection. Older listeners close
	// over their own generation value and bail out when they see a newer one,
	// so a zombie content script (runtime invalidated after extension update)
	// will silently yield to the freshly-injected instance.
	window.obsidianClipperGeneration = (window.obsidianClipperGeneration ?? 0) + 1;
	const myGeneration = window.obsidianClipperGeneration;

	debugLog('Clipper', 'Initializing content script, generation', myGeneration);

	// Track actual time spent on this page
	let pageTimeStart = Date.now();
	let pageTimeAccumulated = 0;

	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			pageTimeAccumulated += Date.now() - pageTimeStart;
		} else {
			pageTimeStart = Date.now();
		}
	});

	function getTimeOnPage(): number {
		const current = document.hidden
			? pageTimeAccumulated
			: pageTimeAccumulated + (Date.now() - pageTimeStart);
		return Math.floor(current / 1000);
	}

	window.addEventListener('pagehide', () => {
		browser.runtime.sendMessage({ action: 'updateTimeOnPage', timeOnPage: getTimeOnPage() });
	});

	let isHighlighterMode = false;

	// Firefox
	browser.runtime.sendMessage({ action: "contentScriptLoaded" });

	interface ContentResponse {
		content: string;
		selectedHtml: string;
		extractedContent: { [key: string]: string };
		schemaOrgData: any;
		fullHtml: string;
		highlights: string[];
		title: string;
		description: string;
		domain: string;
		favicon: string;
		image: string;
		parseTime: number;
		published: string;
		author: string;
		site: string;
		wordCount: number;
		language: string;
		metaTags: { name?: string | null; property?: string | null; content: string | null }[];
	}

	function showToast(message: string): void {
		const existing = document.getElementById('obsidian-clipper-toast');
		if (existing) existing.remove();

		const toast = document.createElement('div');
		toast.id = 'obsidian-clipper-toast';
		toast.textContent = message;
		toast.style.cssText = [
			'position:fixed',
			'top:24px',
			'right:24px',
			'z-index:2147483647',
			'background:#1a1a2e',
			'color:#fff',
			'padding:10px 16px',
			'border-radius:8px',
			'font:14px/1.4 system-ui,sans-serif',
			'box-shadow:0 4px 12px rgba(0,0,0,.35)',
			'opacity:0',
			'transition:opacity .2s ease',
			'pointer-events:none',
			'max-width:320px',
			'word-break:break-word',
		].join(';');
		document.documentElement.appendChild(toast);

		requestAnimationFrame(() => {
			toast.style.opacity = '1';
			setTimeout(() => {
				toast.style.opacity = '0';
				toast.addEventListener('transitionend', () => toast.remove(), { once: true });
			}, 3000);
		});
	}

	browser.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
		// If a newer generation of this content script has been injected,
		// yield to it rather than responding from a potentially stale context.
		if (window.obsidianClipperGeneration !== myGeneration) {
			return;
		}

		if (request.action === "showToast") {
			showToast(request.message || 'Saved');
			return;
		}

		if (request.action === "ping") {
			sendResponse({});
			return true;
		}

		if (request.action === "copy-text-to-clipboard") {
			const textArea = document.createElement("textarea");
			textArea.value = request.text;
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand('copy');
				sendResponse({success: true});
			} catch (err) {
				sendResponse({success: false});
			}
			document.body.removeChild(textArea);
			return true;
		}

		if (request.action === "copyMarkdownToClipboard") {
			flattenShadowDom(document).then(() => {
				try {
					const defuddled = parseForClip(document);

					// Convert HTML content to markdown
					const markdown = createMarkdownContent(defuddled.content, document.URL);

					// Copy to clipboard
					const textArea = document.createElement("textarea");
					textArea.value = markdown;
					document.body.appendChild(textArea);
					textArea.select();
					document.execCommand('copy');
					document.body.removeChild(textArea);

					sendResponse({ success: true });
				} catch (err) {
					console.error('Failed to copy markdown to clipboard:', err);
					sendResponse({ success: false, error: (err as Error).message });
				}
			});
			return true;
		}

		if (request.action === "saveMarkdownToFile") {
			flattenShadowDom(document).then(async () => {
				try {
					const defuddled = parseForClip(document);
					const markdown = createMarkdownContent(defuddled.content, document.URL);
					const title = defuddled.title || document.title || 'Untitled';
					const fileName = title.replace(/[/\\?%*:|"<>]/g, '-');
					await saveFile({
						content: markdown,
						fileName,
						mimeType: 'text/markdown',
					});
					sendResponse({ success: true });
				} catch (err) {
					console.error('Failed to save markdown file:', err);
					sendResponse({ success: false, error: (err as Error).message });
				}
			});
			return true;
		}

		if (request.action === "getMarkdownContent") {
			const flattenTimeout = new Promise<void>(resolve => setTimeout(resolve, 3000));
			Promise.race([flattenShadowDom(document), flattenTimeout]).then(() => {
				try {
					const defuddled = parseForClip(document);
					const markdown = createMarkdownContent(defuddled.content, document.URL);
					sendResponse({
						success: true,
						markdown,
						title: defuddled.title || document.title || 'Untitled',
						url: document.URL,
						author: defuddled.author || '',
						description: defuddled.description || '',
						published: defuddled.published || '',
						timeOnPage: getTimeOnPage(),
					});
				} catch (err) {
					sendResponse({ success: false, error: (err as Error).message });
				}
			});
			return true;
		}

		if (request.action === "getPageContent") {
			// Flatten shadow DOM before extraction (async, needs main world)
			const flattenTimeout = new Promise<void>(resolve => setTimeout(resolve, 3000));
			Promise.race([flattenShadowDom(document), flattenTimeout]).then(async () => {
				let selectedHtml = '';
				const selection = window.getSelection();

				if (selection && selection.rangeCount > 0) {
					const range = selection.getRangeAt(0);
					const clonedSelection = range.cloneContents();
					const div = document.createElement('div');
					div.appendChild(clonedSelection);
					selectedHtml = serializeChildren(div);
				}

				// Use parseAsync to ensure async variables like {{transcript}} are available.
				// If it hangs (e.g. another extension has corrupted fetch), fall back to sync parse.
				const defuddle = new Defuddle(document, { url: document.URL });
				const parseTimeout = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('parseAsync timeout')), 8000)
				);
				const defuddled = await Promise.race([defuddle.parseAsync(), parseTimeout])
					.catch(() => defuddle.parse());
				const extractedContent: { [key: string]: string } = {
					...defuddled.variables,
				};

				// Create a new DOMParser
				const parser = new DOMParser();
				// Parse the document's HTML
				const doc = parser.parseFromString(document.documentElement.outerHTML, 'text/html');

				// Remove all script and style elements
				doc.querySelectorAll('script, style').forEach(el => el.remove());

				// Remove style attributes from all elements
				doc.querySelectorAll('*').forEach(el => el.removeAttribute('style'));

				// Convert all relative URLs to absolute
				doc.querySelectorAll('[src], [href]').forEach(element => {
					['src', 'href', 'srcset'].forEach(attr => {
						const value = element.getAttribute(attr);
						if (!value) return;

						if (attr === 'srcset') {
							const newSrcset = value.split(',').map(src => {
								const [url, size] = src.trim().split(' ');
								try {
									const absoluteUrl = new URL(url, document.baseURI).href;
									return `${absoluteUrl}${size ? ' ' + size : ''}`;
								} catch (e) {
									return src;
								}
							}).join(', ');
							element.setAttribute(attr, newSrcset);
						} else if (!value.startsWith('http') && !value.startsWith('data:') && !value.startsWith('#') && !value.startsWith('//')) {
							try {
								const absoluteUrl = new URL(value, document.baseURI).href;
								element.setAttribute(attr, absoluteUrl);
							} catch (e) {
								console.warn(`Failed to process ${attr} URL:`, value);
							}
						}
					});
				});

				// Get the modified HTML without scripts, styles, and style attributes
				const cleanedHtml = doc.documentElement.outerHTML;

				const response: ContentResponse = {
					author: defuddled.author,
					content: defuddled.content,
					description: defuddled.description,
					domain: getDomain(document.URL),
					extractedContent: extractedContent,
					favicon: defuddled.favicon,
					fullHtml: cleanedHtml,
					highlights: highlighter.getHighlights(),
					image: defuddled.image,
					language: defuddled.language || '',
					parseTime: defuddled.parseTime,
					published: defuddled.published,
					schemaOrgData: defuddled.schemaOrgData,
					selectedHtml: selectedHtml,
					site: defuddled.site,
					title: defuddled.title,
					wordCount: defuddled.wordCount,
					metaTags: defuddled.metaTags || []
				};
				if (defuddled.title) {
					highlighter.setPageTitle(defuddled.title);
				}
				highlighter.updatePageDomainSettings({ site: defuddled.site, favicon: defuddled.favicon });
				sendResponse(response);
			}).catch((error: unknown) => {
				console.error('[Obsidian Clipper] getPageContent error:', error);
				sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
			});
			return true;
		} else if (request.action === "extractContent") {
			const content = extractContentBySelector(request.selector, request.attribute, request.extractHtml);
			sendResponse({ content: content });
		} else if (request.action === "paintHighlights") {
			ensureHighlighterCSS().then(() => highlighter.loadHighlights()).then(() => {
				if (generalSettings.alwaysShowHighlights) {
					highlighter.applyHighlights();
				}
				sendResponse({ success: true });
			});
			return true;
		} else if (request.action === "setHighlighterMode") {
			isHighlighterMode = request.isActive;
			ensureHighlighterCSS();
			highlighter.toggleHighlighterMenu(isHighlighterMode);
			updateHasHighlights();
			sendResponse({ success: true });
			return true;
		} else if (request.action === "getHighlighterMode") {
			browser.runtime.sendMessage({ action: "getHighlighterMode" }).then(sendResponse);
			return true;
		} else if (request.action === "toggleHighlighter") {
			ensureHighlighterCSS();
			highlighter.toggleHighlighterMenu(request.isActive);
			updateHasHighlights();
			sendResponse({ success: true });
		} else if (request.action === "highlightSelection") {
			ensureHighlighterCSS();
			highlighter.toggleHighlighterMenu(request.isActive);
			const selection = window.getSelection();
			if (selection && !selection.isCollapsed) {
				highlighter.handleTextSelection(selection);
			}
			updateHasHighlights();
			sendResponse({ success: true });
		} else if (request.action === "highlightElement") {
			ensureHighlighterCSS();
			highlighter.toggleHighlighterMenu(request.isActive);
			if (request.targetElementInfo) {
				const { mediaType, srcUrl, pageUrl } = request.targetElementInfo;
				
				let elementToHighlight: Element | null = null;

				// Function to compare URLs, handling both absolute and relative paths
				const urlMatches = (elementSrc: string, targetSrc: string) => {
					const elementUrl = new URL(elementSrc, pageUrl);
					const targetUrl = new URL(targetSrc, pageUrl);
					return elementUrl.href === targetUrl.href;
				};

				// Try to find the element using the src attribute
				elementToHighlight = document.querySelector(`${mediaType}[src="${srcUrl}"]`);

				// If not found, try with relative URL
				if (!elementToHighlight) {
					const relativeSrc = new URL(srcUrl).pathname;
					elementToHighlight = document.querySelector(`${mediaType}[src="${relativeSrc}"]`);
				}

				// If still not found, iterate through all elements of the media type
				if (!elementToHighlight) {
					const elements = Array.from(document.getElementsByTagName(mediaType));
					for (const el of elements) {
						if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) {
							if (urlMatches(el.src, srcUrl)) {
								elementToHighlight = el;
								break;
							}
						}
					}
				}

				if (elementToHighlight) {
					highlighter.highlightElement(elementToHighlight);
				} else {
					console.warn('Could not find element to highlight. Info:', request.targetElementInfo);
				}
			}
			updateHasHighlights();
			sendResponse({ success: true });
		} else if (request.action === "clearHighlights") {
			highlighter.clearHighlights();
			updateHasHighlights();
			sendResponse({ success: true });
		} else if (request.action === "getHighlighterState") {
			browser.runtime.sendMessage({ action: "getHighlighterMode" })
				.then(response => {
					sendResponse(response);
				})
				.catch(error => {
					console.error("Error getting highlighter mode:", error);
					sendResponse({ isActive: false });
				});
			return true;
		} else if (request.action === "getTimeOnPage") {
			sendResponse({ timeOnPage: getTimeOnPage() });
			return true;
		}
		return true;
	});

	function extractContentBySelector(selector: string, attribute?: string, extractHtml: boolean = false): string | string[] {
		return extractContentBySelectorShared(document, selector, attribute, extractHtml);
	}

	function updateHasHighlights() {
		const hasHighlights = highlighter.getHighlights().length > 0;
		browser.runtime.sendMessage({ action: "updateHasHighlights", hasHighlights });
	}

	let highlighterCSSPromise: Promise<void> | null = null;
	function ensureHighlighterCSS(): Promise<void> {
		if (!highlighterCSSPromise) {
			highlighterCSSPromise = new Promise<void>((resolve) => {
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = browser.runtime.getURL('highlighter.css');
				link.onload = () => resolve();
				link.onerror = () => resolve();
				(document.head || document.documentElement).appendChild(link);
			});
		}
		return highlighterCSSPromise;
	}

	async function initializeHighlighter() {
		await loadSettings();

		if (generalSettings.alwaysShowHighlights) {
			const result = await browser.storage.local.get('highlights');
			const allHighlights = (result.highlights || {}) as Record<string, unknown>;
			if (allHighlights[window.location.href]) {
				await ensureHighlighterCSS();
			}
		}

		await highlighter.loadHighlights();
		highlighter.setPageTitle(document.title);
		updateHasHighlights();
	}

	// Initialize highlighter
	initializeHighlighter();

	// Expose highlighter API on window so other injected bundles can delegate
	// all state operations to this single module instance (one source of truth per tab).
	window.__obsidianHighlighter = {
		toggleHighlighterMenu: highlighter.toggleHighlighterMenu,
		handleTextSelection: highlighter.handleTextSelection,
		highlightElement: highlighter.highlightElement,
		applyHighlights: highlighter.applyHighlights,
		loadHighlights: highlighter.loadHighlights,
		invalidateHighlightCache: highlighter.invalidateHighlightCache,
		repositionHighlights: highlighter.repositionHighlights,
		getHighlights: highlighter.getHighlights,
		setPageUrl: highlighter.setPageUrl,
		setPageTitle: highlighter.setPageTitle,
		updatePageDomainSettings: highlighter.updatePageDomainSettings,
		clearHighlights: highlighter.clearHighlights,
		saveHighlights: highlighter.saveHighlights,
		updateHighlighterMenu: highlighter.updateHighlighterMenu,
		removeExistingHighlights,
		ensureHighlighterCSS: () => { ensureHighlighterCSS(); },
	} satisfies highlighter.HighlighterAPI;

	// Call updateHasHighlights when the page loads
	window.addEventListener('load', updateHasHighlights);

	// Deactivate highlighter mode on unload
	function handlePageUnload() {
		if (isHighlighterMode) {
			highlighter.toggleHighlighterMenu(false);
			browser.runtime.sendMessage({ action: "highlighterModeChanged", isActive: false });
			browser.storage.local.set({ isHighlighterMode: false });
		}
	}

	window.addEventListener('beforeunload', handlePageUnload);

})();
