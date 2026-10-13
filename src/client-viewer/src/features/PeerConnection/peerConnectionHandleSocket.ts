import { ErrorMessage } from '../../components/ErrorDialog/ErrorMessageEnum';
import {
	getBrowserFromUAParser,
	getDeviceTypeFromUAParser,
	getOSFromUAParser,
} from '../../utils/userAgentParserHelpers';
import PeerConnectionSocketNotDefined from './errors/PeerConnectionSocketNotDefined';
import setAndShowErrorDialogMessage from './setAndShowErrorDialogMessage';

export function getMyIPCallback(
	peerConnection: PeerConnection,
	ip: string,
	userAgent: string,
) {
	peerConnection.myDeviceDetails.myIP = ip;

	peerConnection.uaParser.setUA(userAgent);
	peerConnection.myDeviceDetails.myOS = getOSFromUAParser(
		peerConnection.uaParser,
	);
	peerConnection.myDeviceDetails.myDeviceType = getDeviceTypeFromUAParser(
		peerConnection.uaParser,
	);
	peerConnection.myDeviceDetails.myBrowser = getBrowserFromUAParser(
		peerConnection.uaParser,
	);

	peerConnection.initApp(peerConnection.user, ip);
}

export default (peerConnection: PeerConnection) => {
	let disconnectCount = 0;
	let isAllowed = true;
	const socket = peerConnection.socket;
	if (!socket) {
		throw new PeerConnectionSocketNotDefined();
	}

	socket.on('disconnect', () => {
		disconnectCount++;
		peerConnection.isReconnecting = true;
		console.warn(
			`[Socket] Disconnected from server (count: ${disconnectCount}). Attempting auto-reconnect...`,
		);

		// If connected via USB (localhost) and a Wi-Fi fallback host is available,
		// switch to the fallback host after 2 failed attempts to prevent total session failure
		if (disconnectCount >= 2 && !peerConnection.isUsingFallbackHost) {
			const fallback = peerConnection.getFallbackHost();
			if (fallback) {
				console.log(
					`[Socket] USB disconnected. Activating Wi-Fi fallback transport: ${fallback}`,
				);
				peerConnection.switchToFallbackHost(fallback);
				return;
			}
		}

		// Wait for sustained failure (e.g. > 15 attempts / > 60 seconds) before showing fatal error
		if (disconnectCount > 15 && isAllowed) {
			peerConnection.isReconnecting = false;
			if (peerConnection.isStreamStarted) {
				peerConnection.stopStream();
			}
			setAndShowErrorDialogMessage(peerConnection, ErrorMessage.DISCONNECTED);
		}
	});

	const handleConnect = () => {
		let ipCallbackReceived = false;
		disconnectCount = 0;

		// Clear any transient error dialog on successful connection or reconnection
		try {
			peerConnection.UIHandler.setIsErrorDialogOpen(false);
			peerConnection.UIHandler.errorDialogMessage = ErrorMessage.UNKNOWN_ERROR;
		} catch {
			// ignore
		}

		// clear any existing reconnect timeout
		if (peerConnection.reconnectTimeout) {
			clearTimeout(peerConnection.reconnectTimeout);
		}

		peerConnection.reconnectTimeout = setTimeout(() => {
			if (!ipCallbackReceived && isAllowed) {
				console.log('GET_MY_IP callback not received, reconnecting socket');
				socket.disconnect();
				socket.connect();
			}
		}, 3000);

		// clear any existing getMyIP timeout
		if (peerConnection.getMyIPTimeout) {
			clearTimeout(peerConnection.getMyIPTimeout);
		}

		peerConnection.getMyIPTimeout = setTimeout(() => {
			if (!isAllowed) return;
			socket.emit('GET_MY_IP', (ip: string) => {
				console.log('GET_MY_IP', ip);
				ipCallbackReceived = true;
				if (peerConnection.reconnectTimeout) {
					clearTimeout(peerConnection.reconnectTimeout);
					peerConnection.reconnectTimeout = null;
				}
				getMyIPCallback(peerConnection, ip, window.navigator.userAgent);
			});
		}, 50);
	};

	socket.on('connect', handleConnect);
	if (socket.connected) {
		handleConnect();
	}

	socket.on('NOT_ALLOWED', () => {
		isAllowed = false;
		setAndShowErrorDialogMessage(peerConnection, ErrorMessage.NOT_ALLOWED);
	});

	socket.on('USER_ENTER', (payload: { users: PartnerPeerUser[] }) => {
		if (!isAllowed) return;
		const filteredPartner = payload.users.filter((v) => {
			return peerConnection.user.username !== v.username;
		});

		peerConnection.partner = filteredPartner[0];

		if (!peerConnection.partner) return;

		let cachedToken: string | null = null;
		try {
			cachedToken = localStorage.getItem('deskreen_reconnect_token');
		} catch {
			// ignore localStorage error in private mode
		}
		const urlParams = new URLSearchParams(window.location.search);
		const reconnectToken =
			urlParams.get('reconnectToken') || cachedToken || undefined;
		const isUsb =
			urlParams.get('transport') === 'usb' ||
			window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1';

		peerConnection.sendEncryptedMessage({
			type: 'DEVICE_DETAILS',
			payload: {
				os: peerConnection.myDeviceDetails.myOS,
				deviceType: peerConnection.myDeviceDetails.myDeviceType,
				browser: peerConnection.myDeviceDetails.myBrowser,
				deviceScreenWidth: window.screen.width,
				deviceScreenHeight: window.screen.height,
				reconnectToken,
				transportType: isUsb ? 'usb' : 'wifi',
			},
		});

		peerConnection.sendEncryptedMessage({
			type: 'GET_APP_LANGUAGE',
			payload: {},
		});

		// clear any existing timeout
		if (peerConnection.setMyDeviceDetailsTimeout) {
			clearTimeout(peerConnection.setMyDeviceDetailsTimeout);
		}

		peerConnection.setMyDeviceDetailsTimeout = setTimeout(() => {
			peerConnection.UIHandler.setMyDeviceDetails({
				myIP: peerConnection.myDeviceDetails.myIP,
				myOS: peerConnection.myDeviceDetails.myOS,
				myBrowser: peerConnection.myDeviceDetails.myBrowser,
				myDeviceType: peerConnection.myDeviceDetails.myDeviceType,
				myRoomId: peerConnection.roomId,
			});
		}, 100);
	});

	// peerConnection.socket.on('USER_EXIT', (payload: any) => {
	//   // peerConnection.props.receiveUnencryptedMessage('USER_EXIT', payload);
	// });

	socket.on('MESSAGE', (payload: ReceiveEncryptedMessagePayload) => {
		if (!isAllowed) return;
		peerConnection.receiveEncryptedMessage(payload);
	});

	socket.on('ROOM_LOCKED', () => {
		setAndShowErrorDialogMessage(peerConnection, ErrorMessage.DENY_TO_CONNECT);
	});
};
