import getDesktopSourceStreamBySourceID from './getDesktopSourceStreamBySourceID';
import DesktopCapturerSourceType from '../../../../common/DesktopCapturerSourceType';

export default async function createDesktopCapturerStream(
	peerConnection: PeerConnection,
	sourceID: string,
): Promise<void> {
	try {
		if (typeof process !== 'undefined' && process.env?.RUN_MODE === 'test')
			return;

		if (sourceID.includes(DesktopCapturerSourceType.SCREEN)) {
			const stream = await getDesktopSourceStreamBySourceID(
				sourceID,
				peerConnection.sourceDisplaySize?.width,
				peerConnection.sourceDisplaySize?.height,
				0.5,
				1,
			);
			peerConnection.localStream = stream;
		} else {
			// when source is app window, request full high resolution (1080p fallback) at 30-60 fps
			const targetWidth = peerConnection.sourceDisplaySize?.width || 1920;
			const targetHeight = peerConnection.sourceDisplaySize?.height || 1080;
			const stream = await getDesktopSourceStreamBySourceID(
				sourceID,
				targetWidth,
				targetHeight,
				0.5,
				1,
				30,
				60,
			);
			peerConnection.localStream = stream;
		}
	} catch (e) {
		console.error(e);
	}
}
