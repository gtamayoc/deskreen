import DesktopCapturerSourceType from '../../../../common/DesktopCapturerSourceType';
import { IpcEvents } from '../../../../common/IpcEvents.enum';
import getDesktopSourceStreamBySourceID from './getDesktopSourceStreamBySourceID';
import prepareDataMessageToSendScreenSourceType from './prepareDataMessageToSendScreenSourceType';
import NullSimplePeer from './NullSimplePeer';
import { replacePeerVideoTrack } from './replacePeerVideoTrack';

interface PeerDataMessage {
	type?: string;
	payload?: {
		value?: number;
		[key: string]: unknown;
	};
}

export default async function handlePeerOnData(
	peerConnection: PeerConnection,
	data: string,
): Promise<void> {
	let dataJSON: PeerDataMessage;
	try {
		dataJSON = JSON.parse(data) as PeerDataMessage;
	} catch (err) {
		console.warn('Failed to parse peer data message:', err);
		return;
	}

	if (
		dataJSON.type === 'deskreen-remote-input' ||
		dataJSON.type === 'remote_pointer_input' ||
		dataJSON.type === 'remote_input'
	) {
		const partnerDetails = peerConnection.partnerDeviceDetails;
		const deviceFingerprint = partnerDetails
			? `${partnerDetails.deviceIP}_${partnerDetails.deviceOS}_${partnerDetails.deviceBrowser}`
			: undefined;

		if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
			try {
				await window.electron.ipcRenderer.invoke(
					IpcEvents.InjectRemoteConsoleInput,
					{
						sessionId: peerConnection.sharingSessionID,
						deviceFingerprint,
						payload: dataJSON.payload,
					},
				);
			} catch (err) {
				console.warn('[handlePeerOnData] Failed to inject remote input:', err);
			}
		}
		return;
	}

	if (dataJSON.type === 'set_video_quality' && dataJSON.payload) {
		const maxVideoQualityMultiplier = dataJSON.payload.value ?? 1;
		const minVideoQualityMultiplier =
			maxVideoQualityMultiplier === 1 ? 0.5 : maxVideoQualityMultiplier;

		const targetWidth = peerConnection.sourceDisplaySize?.width || 1920;
		const targetHeight = peerConnection.sourceDisplaySize?.height || 1080;

		const newStream = await getDesktopSourceStreamBySourceID(
			peerConnection.desktopCapturerSourceID,
			targetWidth,
			targetHeight,
			minVideoQualityMultiplier,
			maxVideoQualityMultiplier,
			30,
			60,
		);
		const newVideoTrack = newStream.getVideoTracks()[0];
		const oldStream = peerConnection.localStream;
		const oldTrack = oldStream?.getVideoTracks()[0];

		if (oldTrack && oldStream && peerConnection.peer !== NullSimplePeer) {
			await replacePeerVideoTrack(
				peerConnection.peer,
				oldTrack,
				newVideoTrack,
				oldStream,
				newStream,
			);
			// stop only the old track (it's already removed from the stream by replaceTrack)
			oldTrack.stop();
			// stop any remaining tracks in the old stream, but don't stop the new track
			oldStream.getTracks().forEach((track) => {
				if (track.id !== newVideoTrack.id) {
					track.stop();
				}
			});
		}

		// update local stream reference to new stream
		peerConnection.localStream = newStream;
	}

	if (dataJSON.type === 'get_sharing_source_type') {
		const sourceType = peerConnection.desktopCapturerSourceID.includes(
			DesktopCapturerSourceType.SCREEN,
		)
			? DesktopCapturerSourceType.SCREEN
			: DesktopCapturerSourceType.WINDOW;

		try {
			if (peerConnection.desktopCapturerSourceID) {
				await peerConnection.setSourceMetadataByDesktopCapturerSourceID();
			}
			if (peerConnection.peer && peerConnection.peer !== NullSimplePeer) {
				peerConnection.peer.send(
					prepareDataMessageToSendScreenSourceType(
						sourceType,
						peerConnection.isConsoleSource,
						peerConnection.sourceName,
					),
				);
			}
		} catch (err) {
			console.warn('Failed to send screen source type to peer:', err);
		}
	}
}
