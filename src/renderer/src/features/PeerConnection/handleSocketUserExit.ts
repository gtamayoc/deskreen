import NullSimplePeer from './NullSimplePeer';

export default (peerConnection: PeerConnection): void => {
	if (peerConnection.isSocketRoomLocked) {
		peerConnection.toggleLockRoom(false);
		if (peerConnection.isCallStarted) {
			peerConnection.isReconnecting = true;
			peerConnection.onReconnectingStateChanged(true);
			if (peerConnection.peer !== NullSimplePeer) {
				try {
					peerConnection.peer.removeAllListeners();
					peerConnection.peer.destroy();
				} catch (err) {
					console.error('Error destroying peer on user exit:', err);
				}
				peerConnection.peer = NullSimplePeer;
			}
			peerConnection.isCallStarted = false;
			peerConnection.signalsDataToCallUser = [];
		}
	}
};
