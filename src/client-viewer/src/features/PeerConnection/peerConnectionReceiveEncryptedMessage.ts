import { ErrorMessage } from '../../components/ErrorDialog/ErrorMessageEnum';
import { process as processMessage } from '../../utils/message';
import NullUser from './NullUser';
import PeerConnectionUserIsNotDefinedError from './errors/PeerConnectionUserIsNotDefinedError';
import setAndShowErrorDialogMessage from './setAndShowErrorDialogMessage';

export default async (
	peerConnection: PeerConnection,
	payload: ReceiveEncryptedMessagePayload,
) => {
	if (peerConnection.user === NullUser) {
		throw new PeerConnectionUserIsNotDefinedError();
	}
	const message = await processMessage(payload);
	// const message = payload as any;
	if (message.type === 'CALL_USER') {
		try {
			if (!peerConnection.peer || peerConnection.peer.destroyed) {
				peerConnection.createPeer();
			}
			if (peerConnection.peer && !peerConnection.peer.destroyed) {
				peerConnection.peer.signal(message.payload.signalData);
			}
		} catch (signalError) {
			console.warn('Caught client WebRTC peer signaling error safely:', signalError);
		}
	}
	if (message.type === 'DENY_TO_CONNECT') {
		setAndShowErrorDialogMessage(peerConnection, ErrorMessage.DENY_TO_CONNECT);
	}
	if (message.type === 'DISCONNECT_BY_HOST_MACHINE_USER') {
		setAndShowErrorDialogMessage(peerConnection, ErrorMessage.DISCONNECTED);
	}
	if (message.type === 'ALLOWED_TO_CONNECT') {
		const payloadObj = message.payload as
			| { reconnectToken?: string }
			| undefined;
		if (payloadObj?.reconnectToken) {
			try {
				localStorage.setItem(
					'deskreen_reconnect_token',
					payloadObj.reconnectToken,
				);
			} catch {
				// ignore localStorage errors
			}
		}
		peerConnection.UIHandler.hostAllowedToConnectCallback();
	}
	if (message.type === 'APP_LANGUAGE') {
		peerConnection.UIHandler.setAppLanguageCallback(message.payload.value);
	}
	if (message.type === 'AVAILABLE_SOURCES') {
		const payloadObj = message.payload as {
			sources?: Array<{
				id: string;
				name: string;
				type: 'screen' | 'window';
				appIcon?: string;
			}>;
			currentSourceId?: string;
		};
		window.dispatchEvent(
			new CustomEvent('deskreen:available-sources', {
				detail: payloadObj,
			}),
		);
	}
	if (message.type === 'SOURCE_SWITCHED') {
		const payloadObj = message.payload as { sourceId?: string };
		window.dispatchEvent(
			new CustomEvent('deskreen:source-switched', {
				detail: payloadObj,
			}),
		);
	}
};
