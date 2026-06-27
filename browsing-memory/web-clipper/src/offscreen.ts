import { loadDirectoryHandle } from './utils/directory-handle-db';
import { saveFileToDirectory } from './utils/file-utils';

interface FileSystemHandleWithPermission extends FileSystemDirectoryHandle {
	queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.target !== 'offscreen' || message.action !== 'offscreen-saveFile') return false;

	(async () => {
		try {
			const handle = await loadDirectoryHandle();
			if (!handle) {
				sendResponse({ success: false, error: 'no-handle' });
				return;
			}

			const h = handle as FileSystemHandleWithPermission;
			const permState = await h.queryPermission({ mode: 'readwrite' });
			if (permState !== 'granted') {
				sendResponse({ success: false, needsPermission: true });
				return;
			}

			await saveFileToDirectory(handle, message.fileName as string, message.content as string);
			sendResponse({ success: true });
		} catch (err) {
			sendResponse({ success: false, error: (err as Error).message });
		}
	})();

	return true;
});
