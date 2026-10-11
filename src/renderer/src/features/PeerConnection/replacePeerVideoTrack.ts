import NullSimplePeer from './NullSimplePeer';

interface SimplePeerWithInternals {
	_pc?: RTCPeerConnection;
	_senderMap?: Map<MediaStreamTrack, Map<MediaStream, RTCRtpSender>>;
	replaceTrack?: (
		oldTrack: MediaStreamTrack,
		newTrack: MediaStreamTrack,
		stream: MediaStream,
	) => Promise<void>;
}

/**
 * Robustly replaces the video track on an active WebRTC PeerConnection without breaking signaling.
 * Uses native RTCRtpSender.replaceTrack directly from the underlying RTCPeerConnection,
 * synchronizing SimplePeer's internal _senderMap so subsequent source swaps succeed seamlessly.
 */
export async function replacePeerVideoTrack(
	peer: unknown,
	oldTrack: MediaStreamTrack | undefined,
	newVideoTrack: MediaStreamTrack,
	oldStream: MediaStream | null,
	newStream: MediaStream,
): Promise<void> {
	if (!peer || peer === NullSimplePeer) {
		throw new Error('Peer is null or inactive');
	}

	const peerInternal = peer as SimplePeerWithInternals;
	let trackReplaced = false;

	// 1. Direct WebRTC RTCRtpSender replacement
	const pc = peerInternal._pc;
	if (pc && typeof pc.getSenders === 'function') {
		const senders = pc.getSenders();
		const videoSender =
			(oldTrack ? senders.find((s) => s.track === oldTrack) : undefined) ||
			senders.find((s) => s.track && s.track.kind === 'video') ||
			senders.find((s) => !s.track);

		if (videoSender && typeof videoSender.replaceTrack === 'function') {
			await videoSender.replaceTrack(newVideoTrack);
			trackReplaced = true;

			// Synchronize SimplePeer internal _senderMap so future lookups succeed
			if (peerInternal._senderMap) {
				const submap = new Map<MediaStream, RTCRtpSender>();
				submap.set(newStream, videoSender);
				if (oldStream) {
					submap.set(oldStream, videoSender);
				}
				peerInternal._senderMap.set(newVideoTrack, submap);
				if (oldTrack) {
					peerInternal._senderMap.set(oldTrack, submap);
				}
			}
		}
	}

	// 2. SimplePeer replaceTrack fallback
	if (
		!trackReplaced &&
		typeof peerInternal.replaceTrack === 'function' &&
		oldTrack &&
		oldStream
	) {
		if (peerInternal._senderMap && !peerInternal._senderMap.get(oldTrack)) {
			const submap = new Map<MediaStream, RTCRtpSender>();
			const pcSenders = pc?.getSenders?.() || [];
			const sender =
				pcSenders.find((s) => s.track?.kind === 'video') || pcSenders[0];
			if (sender) {
				submap.set(oldStream, sender);
				peerInternal._senderMap.set(oldTrack, submap);
			}
		}
		await peerInternal.replaceTrack(oldTrack, newVideoTrack, oldStream);
		trackReplaced = true;
	}

	if (!trackReplaced) {
		throw new Error('No video sender found to replace track');
	}
}
