import { generalSettings, loadSettings, saveSettings, setLocalStorage, getLocalStorage, getClipHistory } from '../utils/storage-utils';
import { saveDirectoryHandle, loadDirectoryHandle, clearDirectoryHandle, verifyPermission } from '../utils/directory-handle-db';
import { detectBrowser } from '../utils/browser-detection';
import { getMessage, setupLanguageAndDirection } from '../utils/i18n';
import browser from '../utils/browser-polyfill';
import { createUsageChart, aggregateUsageData } from '../utils/charts';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { showModal, hideModal } from '../utils/modal-utils';

dayjs.extend(weekOfYear);

const STORE_URLS = {
	chrome: 'https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf',
	firefox: 'https://addons.mozilla.org/en-US/firefox/addon/web-clipper-obsidian/',
	safari: 'https://apps.apple.com/us/app/obsidian-web-clipper/id6720708363',
	edge: 'https://microsoftedge.microsoft.com/addons/detail/obsidian-web-clipper/eigdjhmgnaaeaonimdklocfekkaanfme'
};

export function initializeGeneralSettings(): void {
	loadSettings().then(async () => {
		await setupLanguageAndDirection();

		const history = await getClipHistory();
		const totalClips = history.length;
		const existingRatings = await getLocalStorage('ratings') || [];

		const rateExtensionSection = document.getElementById('rate-extension');
		if (rateExtensionSection && totalClips >= 20 && existingRatings.length === 0) {
			rateExtensionSection.classList.remove('is-hidden');
		}

		if (totalClips >= 20 && existingRatings.length === 0) {
			const starRating = document.querySelector('.star-rating');
			if (starRating) {
				const stars = starRating.querySelectorAll('.star');
				stars.forEach(star => {
					star.addEventListener('click', async () => {
						const rating = parseInt(star.getAttribute('data-rating') || '0');
						stars.forEach(s => {
							if (parseInt(s.getAttribute('data-rating') || '0') <= rating) {
								s.classList.add('is-active');
							} else {
								s.classList.remove('is-active');
							}
						});
						await handleRating(rating);

						if (rateExtensionSection) {
							rateExtensionSection.style.display = 'none';
						}
					});
				});
			}
		}

		await initializeDefaultSaveDirectory();
		await initializeDomainFilter();
		await initializeUsageChart();

		const feedbackModal = document.getElementById('feedback-modal');
		const feedbackCloseBtn = feedbackModal?.querySelector('.feedback-close-btn');
		if (feedbackCloseBtn) {
			feedbackCloseBtn.addEventListener('click', () => hideModal(feedbackModal));
		}
	});
}

async function initializeDefaultSaveDirectory(): Promise<void> {
	const browseBtn = document.getElementById('browse-save-directory-btn') as HTMLButtonElement;
	const clearBtn = document.getElementById('clear-save-directory-btn') as HTMLButtonElement;
	const nameDisplay = document.getElementById('save-directory-name');
	if (!browseBtn || !clearBtn || !nameDisplay) return;

	const handle = await loadDirectoryHandle();
	nameDisplay.textContent = handle ? handle.name : getMessage('noDirectorySelected');

	browseBtn.addEventListener('click', async () => {
		try {
			const newHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
			await saveDirectoryHandle(newHandle);
			nameDisplay.textContent = newHandle.name;
		} catch {
			// user cancelled
		}
	});

	const { autoSaveNeedsPermission } = await browser.storage.local.get('autoSaveNeedsPermission');
	if (autoSaveNeedsPermission && handle) {
		await browser.storage.local.remove('autoSaveNeedsPermission');
		const banner = document.createElement('div');
		banner.style.cssText = 'padding:12px 16px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;margin:12px 0;display:flex;align-items:center;gap:12px;';
		banner.innerHTML = `<span style="flex:1">Auto-save needs permission to access <strong>${handle.name}</strong>.</span>`;
		const grantBtn = document.createElement('button');
		grantBtn.type = 'button';
		grantBtn.textContent = 'Grant Access';
		grantBtn.style.cssText = 'padding:6px 14px;background:#ffc107;border:none;border-radius:4px;cursor:pointer;font-weight:bold;white-space:nowrap;';
		grantBtn.addEventListener('click', async () => {
			console.log('[AutoSave] requesting permission for:', handle.name);
			const h = handle as any;
			const before = await h.queryPermission({ mode: 'readwrite' });
			console.log('[AutoSave] permission before:', before);
			const granted = await verifyPermission(handle);
			console.log('[AutoSave] verifyPermission result:', granted);
			if (granted) {
				nameDisplay.textContent = handle.name;
				banner.remove();
			}
		});
		banner.appendChild(grantBtn);
		browseBtn.parentElement?.parentElement?.after(banner);
		banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	clearBtn.addEventListener('click', async () => {
		await clearDirectoryHandle();
		nameDisplay.textContent = getMessage('noDirectorySelected');
	});
}

function normalizeDomain(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	try {
		const urlStr = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
		const hostname = new URL(urlStr).hostname;
		return hostname || null;
	} catch {
		return null;
	}
}

async function initializeDomainFilter(): Promise<void> {
	const input = document.getElementById('domain-filter-input') as HTMLInputElement;
	const addBtn = document.getElementById('domain-filter-add-btn') as HTMLButtonElement;
	const listEl = document.getElementById('domain-filter-list');
	const errorEl = document.getElementById('domain-filter-error');
	if (!input || !addBtn || !listEl || !errorEl) return;

	const showError = (msg: string) => {
		errorEl.textContent = msg;
		errorEl.style.display = 'block';
	};
	const clearError = () => {
		errorEl.textContent = '';
		errorEl.style.display = 'none';
	};

	const render = () => {
		listEl.textContent = '';
		const domains = generalSettings.domainFilter || [];
		if (domains.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'setting-item-description';
			empty.textContent = getMessage('domainFilterEmpty');
			listEl.appendChild(empty);
			return;
		}
		domains.forEach(domain => {
			const row = document.createElement('div');
			row.className = 'domain-filter-item';

			const name = document.createElement('span');
			name.className = 'domain-filter-name';
			name.textContent = domain;

			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.className = 'clickable-icon domain-filter-remove-btn';
			removeBtn.textContent = '×';
			removeBtn.title = getMessage('domainFilterRemove');
			removeBtn.setAttribute('aria-label', getMessage('domainFilterRemove'));
			removeBtn.addEventListener('click', async () => {
				const updated = (generalSettings.domainFilter || []).filter(d => d !== domain);
				await saveSettings({ domainFilter: updated });
				render();
			});

			row.appendChild(name);
			row.appendChild(removeBtn);
			listEl.appendChild(row);
		});
	};

	const addDomain = async () => {
		clearError();
		if (!input.value.trim()) {
			showError(getMessage('domainFilterErrorEmpty'));
			return;
		}
		const hostname = normalizeDomain(input.value);
		if (!hostname) {
			showError(getMessage('domainFilterErrorInvalid'));
			return;
		}
		const domains = generalSettings.domainFilter || [];
		if (domains.includes(hostname)) {
			showError(getMessage('domainFilterErrorDuplicate'));
			return;
		}
		await saveSettings({ domainFilter: [...domains, hostname] });
		input.value = '';
		render();
	};

	addBtn.addEventListener('click', addDomain);
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			addDomain();
		}
	});

	render();
}

async function initializeUsageChart(): Promise<void> {
	const chartContainer = document.getElementById('usage-chart');
	const periodSelect = document.getElementById('usage-period-select') as HTMLSelectElement;
	const aggregationSelect = document.getElementById('usage-aggregation-select') as HTMLSelectElement;
	if (!chartContainer || !periodSelect || !aggregationSelect) return;

	const history = await getClipHistory();

	const updateChart = async () => {
		const options = {
			timeRange: periodSelect.value as '30d' | 'all',
			aggregation: aggregationSelect.value as 'day' | 'week' | 'month'
		};

		const chartData = aggregateUsageData(history, options);
		await createUsageChart(chartContainer, chartData);
	};

	await updateChart();

	periodSelect.addEventListener('change', updateChart);
	aggregationSelect.addEventListener('change', updateChart);
}

async function handleRating(rating: number) {
	const existingRatings = await getLocalStorage('ratings') || [];

	const newRating = {
		rating,
		date: new Date().toISOString()
	};

	const updatedRatings = [...existingRatings, newRating];
	generalSettings.ratings = updatedRatings;

	await setLocalStorage('ratings', updatedRatings);
	await saveSettings();

	if (rating >= 4) {
		const browser = await detectBrowser();
		let storeUrl = STORE_URLS.chrome;

		switch (browser) {
			case 'firefox':
			case 'firefox-mobile':
				storeUrl = STORE_URLS.firefox;
				break;
			case 'safari':
			case 'mobile-safari':
			case 'ipad-os':
				storeUrl = STORE_URLS.safari;
				break;
			case 'edge':
				storeUrl = STORE_URLS.edge;
				break;
		}

		window.open(storeUrl, '_blank');
	} else {
		const modal = document.getElementById('feedback-modal');
		showModal(modal);
	}
}
