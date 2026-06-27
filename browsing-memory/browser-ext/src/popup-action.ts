import browser from './utils/browser-polyfill';
import { translatePage, setupLanguageAndDirection } from './utils/i18n';
import { addBrowserClassToHtml } from './utils/browser-detection';
import { initializeIcons } from './icons/icons';
import { initializeSettingToggle, initializeToggles } from './utils/ui-utils';
import { loadSettings, saveSettings, generalSettings } from './utils/storage-utils';

// Minimal popup: the clipper UI has been removed. Saving happens automatically
// in the background. The popup offers an auto-save toggle and a button to open
// the settings page.
document.addEventListener('DOMContentLoaded', async () => {
	await loadSettings();
	await translatePage();
	await setupLanguageAndDirection();
	await addBrowserClassToHtml();

	const settingsButton = document.getElementById('open-settings');
	if (settingsButton) {
		initializeIcons(settingsButton);
		settingsButton.addEventListener('click', async (e) => {
			e.preventDefault();
			try {
				await browser.runtime.sendMessage({ action: 'openOptionsPage' });
				setTimeout(() => window.close(), 50);
			} catch (error) {
				console.error('Error opening options page:', error);
			}
		});
	}

	// Auto-save ON/OFF toggle — controls the background auto-save feature.
	initializeSettingToggle('auto-save-toggle', generalSettings.autoSaveEnabled, (checked) => {
		saveSettings({ autoSaveEnabled: checked });
	});
	// Make the toggle switch itself clickable (adds the container click handler).
	initializeToggles();
});
