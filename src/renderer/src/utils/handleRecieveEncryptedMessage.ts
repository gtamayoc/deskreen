import NullSimplePeer from '../features/PeerConnection/NullSimplePeer';
import { process as processMessage } from './message';
import { IpcEvents } from '../../../common/IpcEvents.enum';

export type CallAcceptedMessageWithPayload = {
	type: 'CALL_ACCEPTED';
	payload: {
		signalData: string;
	};
};

export type CallUserMessageWithPayload = {
	type: 'CALL_USER';
	payload: {
		signalData: string;
	};
};

export type DeviceDetailsMessageWithPayload = {
	type: 'DEVICE_DETAILS';
	payload: {
		deviceType: string;
		os: string;
		browser: string;
		deviceScreenWidth: number;
		deviceScreenHeight: number;
	};
};

export type GetAppLanguageMessageWithPayload = {
	type: 'GET_APP_LANGUAGE';
	payload: Record<string, unknown>;
};

export type AppLanguageMessageWithPayload = {
	type: 'APP_LANGUAGE';
	payload: {
		value: string;
	};
};

export type DenyToConnectMessageWithPayload = {
	type: 'DENY_TO_CONNECT';
	payload: Record<string, unknown>;
};

export type AllowedToConnectMessageWithPayload = {
	type: 'ALLOWED_TO_CONNECT';
	payload: Record<string, unknown>;
};

export type DisconnectByHostMachineUserMessageWithPayload = {
	type: 'DISCONNECT_BY_HOST_MACHINE_USER';
	payload: Record<string, unknown>;
};

export type ProcessedMessage =
	| CallAcceptedMessageWithPayload
	| CallUserMessageWithPayload
	| DeviceDetailsMessageWithPayload
	| GetAppLanguageMessageWithPayload
	| AppLanguageMessageWithPayload
	| DenyToConnectMessageWithPayload
	| AllowedToConnectMessageWithPayload
	| DisconnectByHostMachineUserMessageWithPayload;

export function handleDeviceIPMessage(
	deviceIP: string,
	peerConnection: PeerConnection,
	message: ProcessedMessage,
): void {
	if (message.type !== 'DEVICE_DETAILS') return;
	const device = {
		id: Math.random().toString(),
		deviceIP,
		deviceType: message.payload.deviceType,
		deviceOS: message.payload.os,
		deviceBrowser: message.payload.browser,
		deviceScreenWidth: message.payload.deviceScreenWidth,
		deviceScreenHeight: message.payload.deviceScreenHeight,
		sharingSessionID: peerConnection.sharingSessionID,
		deviceRoomId: peerConnection.roomID,
	};
	peerConnection.partnerDeviceDetails = device;
	peerConnection.onDeviceConnectedCallback(device);
}

export const handleRecieveEncryptedMessage = async (
	peerConnection: PeerConnection,
	payload: ReceiveEncryptedMessagePayload,
): Promise<void> => {
	let message: ProcessedMessage;
	try {
		message = await processMessage(payload);
	} catch (e) {
		console.error('failed to process incoming message', e, payload);
		return;
	}
	// const message = payload as any;
	if (message.type === 'CALL_ACCEPTED') {
		try {
			const peer = peerConnection.peer as {
				_pc?: RTCPeerConnection;
				destroyed?: boolean;
				signal: (data: unknown) => void;
			};
			if (peer && peer !== NullSimplePeer && !peer.destroyed) {
				const signalingState = peer._pc?.signalingState;
				const signalData = message.payload.signalData as { type?: string; candidate?: unknown };
				const isAnswer = signalData && typeof signalData === 'object' && signalData.type === 'answer';
				if (isAnswer && signalingState && signalingState !== 'have-local-offer') {
					console.warn(
						`Skipping duplicate remote answer signal in unexpected signalingState: ${signalingState}`,
					);
					return;
				}
				peer.signal(message.payload.signalData);
			}
		} catch (signalError) {
			console.warn('Caught WebRTC peer signaling error safely:', signalError);
		}
	}
	if (message.type === 'DEVICE_DETAILS') {
		peerConnection.socket.emit(
			'GET_IP_BY_SOCKET_ID',
			payload.fromSocketID,
			(deviceIP: string) => {
				// TODO: need to add myIP in client message.payload.myIP, then if retrieved deviceIP and myIP from client don't match, we were spoofed, then we can interrupt connection immediately!
				handleDeviceIPMessage(deviceIP, peerConnection, message);
			},
		);
	}
	if (message.type === 'GET_APP_LANGUAGE') {
		const appLanguage = await window.electron.ipcRenderer.invoke(
			IpcEvents.GetAppLanguage,
		);
		peerConnection.sendEncryptedMessage({
			type: 'APP_LANGUAGE',
			payload: {
				value: appLanguage,
			},
		});
	}
};
