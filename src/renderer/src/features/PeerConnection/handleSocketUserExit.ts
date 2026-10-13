export default (peerConnection: PeerConnection): void => {
	peerConnection.handlePeerCloseOrExit();
};
