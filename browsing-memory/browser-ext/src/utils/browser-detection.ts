interface KagiWindow extends Window {
	KAGI?: any;
}

interface NavigatorExtended extends Navigator {
	brave?: {
		isBrave: () => Promise<boolean>;
	};
}

declare const window: KagiWindow | undefined;

export async function detectBrowser(): Promise<'chrome' | 'firefox' | 'firefox-mobile' | 'brave' | 'edge' | 'safari' | 'mobile-safari' | 'ipad-os' | 'orion' | 'other'> {
	return "chrome";
}

function isIPad(): boolean {
	return navigator.userAgent.includes('iPad') ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function detectOS(): 'ios' | 'macos' | 'windows' | 'android' | 'linux' | 'other' {
	const platform = ((navigator as any).userAgentData?.platform || navigator.platform || '').toLowerCase();
	const ua = navigator.userAgent.toLowerCase();
	if (/iphone|ipad|ipod/.test(ua) || (/mac/.test(platform) && navigator.maxTouchPoints > 1)) return 'ios';
	if (/mac/.test(platform) || /macintosh/.test(ua)) return 'macos';
	if (/win/.test(platform)) return 'windows';
	if (/android/.test(ua)) return 'android';
	if (/linux/.test(platform)) return 'linux';
	return 'other';
}

export async function addBrowserClassToHtml() {
	const browser = await detectBrowser();
	const htmlElement = document.documentElement;

	// Remove any existing browser classes
	htmlElement.classList.remove(
		'is-firefox-mobile',
		'is-chromium',
		'is-firefox',
		'is-edge',
		'is-chrome',
		'is-brave',
		'is-safari',
		'is-mobile-safari',
		'is-ipad-os',
		'is-orion'
	);

	const os = detectOS();
	if (os === 'macos') htmlElement.classList.add('is-macos');
	else if (os === 'ios') htmlElement.classList.add('is-ios');

	// Add the appropriate class based on the detected browser
	switch (browser) {
		case 'firefox-mobile':
			htmlElement.classList.add('is-mobile', 'is-firefox-mobile', 'is-firefox');
			break;
		case 'firefox':
			htmlElement.classList.add('is-firefox');
			break;
		case 'edge':
			htmlElement.classList.add('is-chromium', 'is-edge');
			break;
		case 'chrome':
			htmlElement.classList.add('is-chromium', 'is-chrome');
			break;
		case 'brave':
			htmlElement.classList.add('is-chromium','is-brave');
			break;
		case 'safari':
			htmlElement.classList.add('is-safari');
			break;
		case 'mobile-safari':
			htmlElement.classList.add('is-mobile', 'is-mobile-safari', 'is-safari');
			break;
		case 'ipad-os':
			htmlElement.classList.add('is-tablet', 'is-ipad-os', 'is-safari');
			break;
		case 'orion':
			htmlElement.classList.add('is-orion');
			break;
		default:
			// For 'other' browsers, we don't add any class
			break;
	}
}
