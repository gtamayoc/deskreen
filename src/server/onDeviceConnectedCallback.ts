import { BrowserWindow } from 'electron';
import { IpcEvents } from '../common/IpcEvents.enum';
import { getDeskreenGlobal } from '../main/helpers/getDeskreenGlobal';
import { deskreenApp } from '../main';
import { Device } from '../common/Device';
import SharingSessionStatusEnum from '../features/SharingSessionService/SharingSessionStatusEnum';

export function onDeviceConnectedCallback(device: Device): void {
	const deskreenGlobal = getDeskreenGlobal();
	const { connectedDevicesService, sharingSessionService } = deskreenGlobal;
	if (!connectedDevicesService.isSlotAvailable()) {
		const waitingSession =
			sharingSessionService.waitingForConnectionSharingSession;
		waitingSession?.denyConnectionForPartner();
		waitingSession?.setStatus(SharingSessionStatusEnum.NOT_CONNECTED);
		sharingSessionService.waitingForConnectionSharingSession = null;
		connectedDevicesService.resetPendingConnectionDevice();
		return;
	}
	connectedDevicesService.setPendingConnectionDevice(device);

	const helperWebContents =
		sharingSessionService.waitingForConnectionSharingSession
			?.peerConnectionHelperRenderer?.webContents;

	if (deskreenApp.mainWindow && !deskreenApp.mainWindow.isDestroyed()) {
		deskreenApp.mainWindow.webContents.send(
			IpcEvents.SetPendingConnectionDevice,
			device,
		);
	} else {
		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed() && win.webContents !== helperWebContents) {
				win.webContents.send(IpcEvents.SetPendingConnectionDevice, device);
			}
		}
	}
}
