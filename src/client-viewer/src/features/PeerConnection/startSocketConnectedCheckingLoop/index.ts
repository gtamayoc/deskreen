import PeerConnection from '..';
import { ErrorMessage } from '../../../components/ErrorDialog/ErrorMessageEnum';
import setAndShowErrorDialogMessage from '../setAndShowErrorDialogMessage';

export default (peerConnection: PeerConnection): NodeJS.Timeout => {
	let disconnectedStreak = 0;
	let pingTimeout: NodeJS.Timeout | null = null;

	const checkConnection = () => {
		if (peerConnection.isDestroyed) {
			if (pingTimeout) {
				clearTimeout(pingTimeout);
				pingTimeout = null;
			}
			return;
		}
		const socket = peerConnection.socket;
		if (!socket) {
			disconnectedStreak++;
			handleDisconnection();
			return;
		}
		const isSocketConnected = !!socket.connected;

		if (isSocketConnected) {
			// perform explicit ping/pong check to verify server is alive
			try {
				if (pingTimeout) {
					clearTimeout(pingTimeout);
				}

				const timeout = setTimeout(() => {
					if (peerConnection.isDestroyed) return;
					// ping timeout - server didn't respond
					disconnectedStreak++;
					handleDisconnection();
				}, 3000);

				pingTimeout = timeout;

				socket.emit('PING', (response: string) => {
					if (pingTimeout) {
						clearTimeout(pingTimeout);
						pingTimeout = null;
					}
					if (peerConnection.isDestroyed) return;

					if (response === 'PONG') {
						disconnectedStreak = 0;
					} else {
						disconnectedStreak++;
						handleDisconnection();
					}
				});
			} catch {
				// socket error during ping
				disconnectedStreak++;
				handleDisconnection();
			}
		} else {
			// socket is not connected
			disconnectedStreak++;
			handleDisconnection();
		}
	};

	const handleDisconnection = () => {
		if (peerConnection.isDestroyed) return;
		// Attempt automatic socket reconnection
		if (peerConnection.socket && !peerConnection.socket.connected) {
			try {
				peerConnection.socket.connect();
			} catch {
				// ignore
			}
		}

		// show error and stop stream only after sustained failure (12 streaks = 60s)
		if (disconnectedStreak >= 12) {
			// stop the video stream
			if (peerConnection.isStreamStarted) {
				peerConnection.stopStream();
			}
			// show error dialog
			setAndShowErrorDialogMessage(peerConnection, ErrorMessage.DISCONNECTED);
		}
	};

	return setInterval(checkConnection, 5000);
};
