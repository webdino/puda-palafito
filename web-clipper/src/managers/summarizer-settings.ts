import { getMessage, getEffectiveLanguage } from '../utils/i18n';
import { isSummarizerSupported, getSummarizerAvailability, createDefaultSummarizer } from '../utils/summarizer';

type StatusMod = 'ok' | 'warn' | 'error' | '';

const TEST_TEXT =
	'これはオンデバイス要約の動作確認用のサンプル文章です。ブラウザ内蔵の要約モデルが実際に' +
	'セッションを作成し、テキストを要約できるかを検証しています。要約が空でなければ、要約機能は' +
	'正しく動作しています。This is a sample text to verify that the on-device summarizer can ' +
	'actually create a session and produce a non-empty summary in this browser context.';

// Wires up the on-device Summarizer model section in the Interpreter settings.
// IMPORTANT: availability() alone is unreliable (it can report 'available' while
// create() still fails), so the button performs a REAL test: download/create the
// model and run a sample summarization, then report the true outcome.
export async function initializeSummarizerModelSection(): Promise<void> {
	const btn = document.getElementById('summarizer-download-btn') as HTMLButtonElement | null;
	const statusEl = document.getElementById('summarizer-status');
	const progressEl = document.getElementById('summarizer-progress');
	const progressBar = document.getElementById('summarizer-progress-bar');
	if (!btn || !statusEl) return;

	const setStatus = (text: string, mod: StatusMod = '') => {
		statusEl.textContent = text;
		statusEl.className = 'summarizer-status' + (mod ? ` mod-${mod}` : '');
	};

	// Browser does not expose the Summarizer API at all.
	if (!isSummarizerSupported()) {
		btn.style.display = 'none';
		setStatus(getMessage('summarizerUnsupported'), 'warn');
		return;
	}

	const { code } = await getEffectiveLanguage();

	// Show the raw availability as information, but DO NOT trust it to hide the
	// button — the model is only proven usable once a real test summary succeeds.
	let availability = 'unknown';
	try {
		availability = await getSummarizerAvailability(code);
	} catch (err) {
		console.warn('Summarizer availability check failed:', err);
	}
	setStatus(
		availability === 'available'
			? getMessage('summarizerUnverified')
			: `${getMessage('summarizerNotDownloaded')} (availability: ${availability})`,
	);

	btn.addEventListener('click', async () => {
		btn.disabled = true;
		setStatus(getMessage('summarizerDownloading', '0'));
		if (progressEl) progressEl.style.display = 'block';
		if (progressBar) progressBar.style.width = '0%';

		const monitor: CreateMonitorCallback = (m) => {
			m.addEventListener('downloadprogress', (e) => {
				const ev = e as ProgressEvent;
				const raw = ev.total > 0 ? (ev.loaded / ev.total) * 100 : ev.loaded * 100;
				const pct = Math.max(0, Math.min(100, Math.round(raw)));
				if (progressBar) progressBar.style.width = `${pct}%`;
				setStatus(getMessage('summarizerDownloading', String(pct)));
			});
		};

		let summarizer: Summarizer | null = null;
		try {
			summarizer = await createDefaultSummarizer(code, monitor);
			if (progressBar) progressBar.style.width = '100%';

			// Real test: actually summarize a sample and require a non-empty result.
			const testSummary = await summarizer.summarize(TEST_TEXT);
			if (testSummary.trim()) {
				setStatus(getMessage('summarizerVerified'), 'ok');
				btn.style.display = 'none';
			} else {
				setStatus(`${getMessage('summarizerTestFailed')} empty result`, 'error');
				btn.disabled = false;
			}
		} catch (err) {
			console.error('Summarizer verification failed:', err);
			const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
			setStatus(`${getMessage('summarizerTestFailed')} ${detail}`, 'error');
			btn.disabled = false;
		} finally {
			if (progressEl) progressEl.style.display = 'none';
			summarizer?.destroy();
		}
	});
}
