import { IpcEvents } from '../../../../common/IpcEvents.enum';

export interface VirtualDisplayStatusResponse {
	totalDisplays: number;
	hasSecondaryDisplay: boolean;
	displays: Array<{
		id: number;
		bounds: { x: number; y: number; width: number; height: number };
		isPrimary: boolean;
	}>;
}

export interface EnsureVirtualDisplayResponse {
	success: boolean;
	message: string;
	displayAdded: boolean;
}

export interface MoveWindowResponse {
	success: boolean;
	targetDisplayId?: string;
	message?: string;
}

export async function getVirtualDisplayStatus(): Promise<VirtualDisplayStatusResponse> {
	if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
		return await window.electron.ipcRenderer.invoke(
			IpcEvents.GetVirtualDisplayStatus,
		);
	}
	return { totalDisplays: 1, hasSecondaryDisplay: false, displays: [] };
}

export async function ensureVirtualDisplay(): Promise<EnsureVirtualDisplayResponse> {
	if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
		return await window.electron.ipcRenderer.invoke(
			IpcEvents.EnsureVirtualDisplay,
		);
	}
	return {
		success: false,
		message: 'Electron IPC not available',
		displayAdded: false,
	};
}

export async function moveWindowToVirtualDisplay(
	windowTitle: string,
): Promise<MoveWindowResponse> {
	if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
		return await window.electron.ipcRenderer.invoke(
			IpcEvents.MoveWindowToVirtualDisplay,
			windowTitle,
		);
	}
	return {
		success: false,
		message: 'Electron IPC not available',
	};
}

export async function restoreWindowFromVirtualDisplay(
	windowTitle: string,
): Promise<boolean> {
	if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
		return await window.electron.ipcRenderer.invoke(
			IpcEvents.RestoreWindowFromVirtualDisplay,
			windowTitle,
		);
	}
	return false;
}
