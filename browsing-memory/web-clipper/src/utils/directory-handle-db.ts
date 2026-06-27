interface FileSystemHandleWithPermission extends FileSystemDirectoryHandle {
	queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
	requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

const DB_NAME = 'obsidian-clipper';
const DB_VERSION = 1;
const STORE_NAME = 'directory-handles';
const HANDLE_KEY = 'default-save-directory';

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
		request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle) ?? null);
		request.onerror = () => reject(request.error);
	});
}

export async function clearDirectoryHandle(): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
	const h = handle as FileSystemHandleWithPermission;
	const status = await h.queryPermission({ mode: 'readwrite' });
	if (status === 'granted') return true;
	const requested = await h.requestPermission({ mode: 'readwrite' });
	return requested === 'granted';
}
