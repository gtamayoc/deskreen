import os from 'os';
import { getDeskreenGlobal } from './getDeskreenGlobal';

export default function isWifiConnected(): boolean {
	try {
		const deskreenGlobal = getDeskreenGlobal();
		if (
			deskreenGlobal?.connectedDevicesService?.getDevices().length > 0 ||
			(deskreenGlobal?.sharingSessionService?.sharingSessions &&
				deskreenGlobal.sharingSessionService.sharingSessions.size > 0)
		) {
			return true;
		}
	} catch {
		// Ignore if globals not yet initialized
	}

	const networkInterfaces = os.networkInterfaces();
	let hasValidInterface = false;

	Object.entries(networkInterfaces).some(([networksKey, networks]) => {
		if (!networks) return false;
		if (networksKey.startsWith('bridge')) return false;

		const hasValidNetwork = networks.some((network) => {
			if (!network.internal && network.family === 'IPv4') {
				hasValidInterface = true;
				return true;
			}
			return false;
		});

		return hasValidNetwork;
	});

	return hasValidInterface;
}
