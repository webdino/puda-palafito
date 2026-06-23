import { initializeGeneralSettings } from '../managers/general-settings';
import { initializeInterpreterSettings } from '../managers/interpreter-settings';
import { showSettingsSection, initializeSidebar } from '../managers/settings-section-ui';
import { createIcons } from 'lucide';
import { icons } from '../icons/icons';
import { getUrlParameters } from '../utils/routing';
import { addBrowserClassToHtml } from '../utils/browser-detection';
import { translatePage, getCurrentLanguage, setLanguage, getAvailableLanguages, getMessage, setupLanguageAndDirection } from '../utils/i18n';

document.addEventListener('DOMContentLoaded', async () => {
	// Apply section from URL params immediately to avoid flash (DOM only, no side effects)
	const { section: initialSection } = getUrlParameters();
	const targetSection = (initialSection === 'general' || initialSection === 'interpreter') ? initialSection : 'general';
	document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
	document.querySelectorAll('#sidebar li[data-section]').forEach(i => i.classList.remove('active'));
	document.getElementById(`${targetSection}-section`)?.classList.add('active');
	document.querySelector(`#sidebar li[data-section="${targetSection}"]`)?.classList.add('active');

	async function initializeSettings(): Promise<void> {
		try {
			await translatePage();

			await initializeGeneralSettings();

			// Initialize interpreter settings with error handling
			try {
				await initializeInterpreterSettings();
			} catch (error) {
				console.error('Error initializing interpreter settings, continuing with defaults:', error);
			}

			await handleUrlParameters();
			initializeSidebar();

			createIcons({ icons });

			// Initialize language selector
			const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
			if (languageSelect) {
				await initializeLanguageSelector(languageSelect);
			}
		} catch (error) {
			console.error('Error during settings initialization:', error);
			// Show a basic error message but continue with minimal functionality
			const errorContainer = document.querySelector('#content');
			if (errorContainer) {
				errorContainer.textContent = '';

				const errorDiv = document.createElement('div');
				errorDiv.style.padding = '20px';
				errorDiv.style.textAlign = 'center';
				
				const heading = document.createElement('h2');
				heading.textContent = 'Settings error';
				errorDiv.appendChild(heading);
				
				const message = document.createElement('p');
				message.textContent = 'There was an error loading your settings. This may be due to corrupted data.';
				errorDiv.appendChild(message);
				
				errorContainer.appendChild(errorDiv);
			}
			
			// Try to initialize at least the sidebar for navigation
			try {
				initializeSidebar();
			} catch (sidebarError) {
				console.error('Failed to initialize sidebar:', sidebarError);
			}
		}
	}

	async function initializeLanguageSelector(languageSelect: HTMLSelectElement): Promise<void> {
		try {
			await setupLanguageAndDirection();
			await translatePage();
			
			// Populate language options
			const languages = getAvailableLanguages();
			const currentLanguage = await getCurrentLanguage();
			
			// Clear existing options
			languageSelect.textContent = '';
			
			// Add language options
			languages.forEach((lang: { code: string; name: string }) => {
				const option = document.createElement('option');
				option.value = lang.code;
				option.textContent = lang.code === '' ? getMessage('systemDefault') : lang.name;
				if (lang.code === currentLanguage) {
					option.selected = true;
				}
				languageSelect.appendChild(option);
			});

			// Add change listener
			languageSelect.addEventListener('change', async () => {
				try {
					await setLanguage(languageSelect.value);
					window.location.reload(); // Force reload the current page
				} catch (error) {
					console.error('Failed to change language:', error);
				}
			});
		} catch (error) {
			console.error('Failed to initialize language selector:', error);
		}
	}

	async function handleUrlParameters(): Promise<void> {
		const { section } = getUrlParameters();

		if (section === 'general' || section === 'interpreter') {
			showSettingsSection(section);
		} else {
			showSettingsSection('general');
		}
	}

	await addBrowserClassToHtml();
	await initializeSettings();
});
