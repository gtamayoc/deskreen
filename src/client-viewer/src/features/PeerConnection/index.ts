import { v4 as uuidv4 } from 'uuid';
import SimplePeer from 'simple-peer';
import { UAParser } from 'ua-parser-js';
import type { Socket } from 'socket.io-client';
import type { LocalPeerUser } from '../../../../common/LocalPeerUser';
import type { SendEncryptedMessagePayload } from '../../../../common/SendEncryptedMessagePayload';
import { connect as connectSocket } from '../../utils/socket';
import {
	prepare as prepareMessage,
	type ProcessedPayload,
} from '../../utils/message';
import config from '../../api/config';
import setSdpMediaBitrate from './setSdpMediaBitrate';
import VideoAutoQualityOptimizer from '../VideoAutoQualityOptimizer';
import {
	VideoQuality,
	type VideoQualityType,
} from '../VideoAutoQualityOptimizer/VideoQualityEnum';
import { prepareDataMessageToChangeQuality } from './simplePeerDataMessages';
import { VIDEO_QUALITY_TO_DECIMAL } from './../../constants/appConstants';
import { ErrorMessage } from '../../components/ErrorDialog/ErrorMessageEnum';
import peerConnectionHandleSocket from './peerConnectionHandleSocket';
import peerConnectionHandlePeer from './peerConnectionHandlePeer';
import peerConnectionReceiveEncryptedMessage from './peerConnectionReceiveEncryptedMessage';
import startSocketConnectedCheckingLoop from './startSocketConnectedCheckingLoop';
import NullUser from './NullUser';
import PeerConnectionUIHandler from './PeerConnectionUIHandler';
import setAndShowErrorDialogMessage from './setAndShowErrorDialogMessage';
import PeerConnectionSocketNotDefined from './errors/PeerConnectionSocketNotDefined';
import PeerConnectionUserIsNotDefinedError from './errors/PeerConnectionUserIsNotDefinedError';
import PeerConnectionPartnerIsNotDefinedError from './errors/PeerConnectionPartnerIsNotDefinedError';

export default class PeerConnection {
	roomId: string;

	socket: Socket | null = null;

	user: LocalPeerUser = NullUser;

	partner: PartnerPeerUser = NullUser;

	peer: null | SimplePeer.Instance = null;

	myDeviceDetails: DeviceDetails = {
		myIP: '',
		myOS: '',
		myDeviceType: '',
		myBrowser: '',
		myRoomId: '',
	};

	setUrlCallback: (url: MediaStream | null) => void;

	uaParser: UAParser;

	screenSharingSourceType: string | undefined = undefined;
	isConsoleSource: boolean = false;
	sharingSourceName: string = '';

	videoQuality: VideoQualityType = VideoQuality.Q_100_PERCENT;

	videoAutoQualityOptimizer: VideoAutoQualityOptimizer;

	isStreamStarted: boolean = false;
	isReconnecting: boolean = false;
	isUsingFallbackHost: boolean = false;
	isDestroyed: boolean = false;
	fallbackHost: string = '';
	usbProbeTimer: NodeJS.Timeout | null = null;
	probeAbortController: AbortController | null = null;
	visibilityChangeHandler: (() => void) | null = null;

	UIHandler: PeerConnectionUIHandler;

	beforeunloadHandler: (() => void) | null = null;

	connectionCheckInterval: NodeJS.Timeout | null = null;

	reconnectTimeout: NodeJS.Timeout | null = null;

	getMyIPTimeout: NodeJS.Timeout | null = null;

	setMyDeviceDetailsTimeout: NodeJS.Timeout | null = null;

	constructor(
		roomId: string,
		setUrlCallback: (url: MediaStream | null) => void,
		videoAutoQualityOptimizer: VideoAutoQualityOptimizer,
		UIHandler: PeerConnectionUIHandler,
	) {
		this.setUrlCallback = setUrlCallback;
		this.videoAutoQualityOptimizer = videoAutoQualityOptimizer;
		this.UIHandler = UIHandler;
		this.roomId = roomId;

		let initialFallback = '';
		try {
			const urlParams = new URLSearchParams(window.location.search);
			initialFallback =
				urlParams.get('fallbackHost') ||
				urlParams.get('hostLanIp') ||
				localStorage.getItem('deskreen_fallback_host') ||
				'';
			if (initialFallback) {
				localStorage.setItem('deskreen_fallback_host', initialFallback);
			}
		} catch {
			// ignore storage errors
		}
		this.fallbackHost = initialFallback;

		this.socket = connectSocket(this.roomId);
		this.uaParser = new UAParser();
		this.createUserAndInitSocket();
		this.createPeer();

		if (!this.roomId || this.roomId === '') {
			setAndShowErrorDialogMessage(this, ErrorMessage.NOT_ALLOWED);
		}

		this.connectionCheckInterval = startSocketConnectedCheckingLoop(this);

		this.visibilityChangeHandler = () => {
			if (this.isDestroyed) return;
			if (
				typeof document !== 'undefined' &&
				document.visibilityState === 'visible'
			) {
				// Mobile browser tab regained foreground visibility after background timer throttling
				if (this.isUsingFallbackHost) {
					void this.probeUsbOnce();
				}
				if (this.socket && !this.socket.connected && !this.isReconnecting) {
					try {
						this.socket.connect();
					} catch {
						// ignore
					}
				}
			}
		};

		if (typeof document !== 'undefined') {
			document.addEventListener(
				'visibilitychange',
				this.visibilityChangeHandler,
			);
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('focus', this.visibilityChangeHandler);
		}
	}

	setVideoQuality(videoQuality: VideoQualityType) {
		this.videoQuality = videoQuality;
		this.videoQualityChangedCallback();
	}

	videoQualityChangedCallback() {
		if (!this.peer) return;
		try {
			if (this.videoQuality === VideoQuality.Q_AUTO) {
				this.peer.send(prepareDataMessageToChangeQuality(1));
			} else {
				this.peer.send(
					prepareDataMessageToChangeQuality(
						VIDEO_QUALITY_TO_DECIMAL[this.videoQuality],
					),
				);
			}
		} catch (e) {
			console.warn('Failed to send video quality message to peer:', e);
		}
	}

	stopStream() {
		// stop the video stream by clearing the stream URL
		this.setUrlCallback(null);
		this.isStreamStarted = false;

		// destroy the peer connection
		if (this.peer) {
			try {
				this.peer.removeAllListeners();
				this.peer.destroy();
			} catch (error) {
				console.error('Error destroying peer connection:', error);
			}
			this.peer = null;
		}
	}

	destroy() {
		this.isDestroyed = true;

		// remove visibility/focus listeners
		if (this.visibilityChangeHandler) {
			if (typeof document !== 'undefined') {
				document.removeEventListener(
					'visibilitychange',
					this.visibilityChangeHandler,
				);
			}
			if (typeof window !== 'undefined') {
				window.removeEventListener('focus', this.visibilityChangeHandler);
			}
			this.visibilityChangeHandler = null;
		}

		// cancel any in-flight USB probe immediately
		if (this.probeAbortController) {
			this.probeAbortController.abort();
			this.probeAbortController = null;
		}

		// remove window event listener
		if (this.beforeunloadHandler) {
			window.removeEventListener('beforeunload', this.beforeunloadHandler);
			this.beforeunloadHandler = null;
		}

		// clear connection check interval
		if (this.connectionCheckInterval) {
			clearInterval(this.connectionCheckInterval);
			this.connectionCheckInterval = null;
		}

		// clear all timeouts
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.getMyIPTimeout) {
			clearTimeout(this.getMyIPTimeout);
			this.getMyIPTimeout = null;
		}
		if (this.setMyDeviceDetailsTimeout) {
			clearTimeout(this.setMyDeviceDetailsTimeout);
			this.setMyDeviceDetailsTimeout = null;
		}
		if (this.usbProbeTimer) {
			clearInterval(this.usbProbeTimer);
			this.usbProbeTimer = null;
		}

		// stop stream if started
		if (this.isStreamStarted) {
			this.stopStream();
		}

		// cleanup peer connection
		if (this.peer) {
			try {
				this.peer.removeAllListeners();
				this.peer.destroy();
			} catch (error) {
				console.error('Error destroying peer:', error);
			}
			this.peer = null;
		}

		// cleanup socket
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
		}
	}

	getFallbackHost(): string {
		if (this.fallbackHost) return this.fallbackHost;
		try {
			return localStorage.getItem('deskreen_fallback_host') || '';
		} catch {
			return '';
		}
	}

	switchToFallbackHost(host: string): void {
		if (this.isDestroyed || this.isUsingFallbackHost || !host) return;
		console.log(
			`[PeerConnection] Switching to Wi-Fi fallback transport: ${host}`,
		);
		this.isUsingFallbackHost = true;
		this.isReconnecting = true;
		config.setHost(host);
		this.reconnectSocket();
		this.startUsbProbeLoop();
	}

	switchToUsbHost(): void {
		if (this.isDestroyed || !this.isUsingFallbackHost) return;
		console.log(
			'[PeerConnection] USB connection re-established! Prioritizing USB transport over Wi-Fi.',
		);
		this.isUsingFallbackHost = false;
		this.isReconnecting = true;
		if (this.probeAbortController) {
			this.probeAbortController.abort();
			this.probeAbortController = null;
		}
		if (this.usbProbeTimer) {
			clearInterval(this.usbProbeTimer);
			this.usbProbeTimer = null;
		}
		config.setHost('localhost');
		this.reconnectSocket();
	}

	startUsbProbeLoop(): void {
		if (this.isDestroyed) return;
		if (this.usbProbeTimer) {
			clearInterval(this.usbProbeTimer);
			this.usbProbeTimer = null;
		}
		// Probe immediately upon starting probe loop without waiting for the first 3s timer tick
		void this.probeUsbOnce();

		this.usbProbeTimer = setInterval(() => {
			void this.probeUsbOnce();
		}, 3000);
	}

	async probeUsbOnce(): Promise<void> {
		if (this.isDestroyed || !this.isUsingFallbackHost) {
			if (this.usbProbeTimer) {
				clearInterval(this.usbProbeTimer);
				this.usbProbeTimer = null;
			}
			return;
		}

		if (this.probeAbortController) {
			this.probeAbortController.abort();
			this.probeAbortController = null;
		}

		const controller = new AbortController();
		this.probeAbortController = controller;
		const port = config.port || 3131;

		try {
			const timeoutId = setTimeout(() => controller.abort(), 1500);
			const resp = await fetch(`http://localhost:${port}/ping`, {
				signal: controller.signal,
				mode: 'cors',
			});
			clearTimeout(timeoutId);

			if (this.isDestroyed || !this.isUsingFallbackHost) {
				return;
			}

			if (resp.ok) {
				this.switchToUsbHost();
			}
		} catch {
			// USB not yet re-established or probe aborted
		} finally {
			if (this.probeAbortController === controller) {
				this.probeAbortController = null;
			}
		}
	}

	reconnectSocket(): void {
		if (this.isDestroyed) return;
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
		}
		this.socket = connectSocket(this.roomId);
		this.createUserAndInitSocket();
	}

	createPeer() {
		if (this.isDestroyed) return;
		// cleanup existing peer before creating new one
		if (this.peer) {
			try {
				this.peer.removeAllListeners();
				this.peer.destroy();
			} catch (error) {
				console.error('Error cleaning up existing peer:', error);
			}
			this.peer = null;
		}

		// In mock/test environments where WebRTC APIs are absent, SimplePeer cannot be instantiated
		const peer = new SimplePeer({
			initiator: false,
			channelName: 'deskreen-remote-input',
			config: { iceServers: [] },
			sdpTransform: (sdp) => {
				let newSDP = sdp;
				newSDP = setSdpMediaBitrate(
					newSDP as unknown as string,
					'video',
					500000,
				) as unknown as typeof sdp;
				return newSDP;
			},
		});

		this.peer = peer;
		this.peer.on('error', (e) => {
			console.error('error in simple peer happened!', e);
			if (!this.isReconnecting && !this.isStreamStarted) {
				setAndShowErrorDialogMessage(this, ErrorMessage.WEBRTC_ERROR);
			} else {
				this.isReconnecting = true;
			}
		});
		peerConnectionHandlePeer(this);
	}

	initApp(user: LocalPeerUser, myIP: string) {
		if (!this.socket) {
			throw new PeerConnectionSocketNotDefined();
		}
		this.socket.emit('USER_ENTER', {
			username: user.username,
			ip: myIP, // TODO: remove as it is not used
		});
	}

	createUser(): LocalPeerUser {
		const username = uuidv4();
		const id = uuidv4();

		return {
			username,
			id,
		};
	}

	sendEncryptedMessage(payload: SendEncryptedMessagePayload) {
		const socket = this.socket;
		if (!socket) {
			throw new PeerConnectionSocketNotDefined();
		}
		if (!this.user || this.user === NullUser) {
			throw new PeerConnectionUserIsNotDefinedError();
		}
		if (!this.partner || this.partner === NullUser) {
			throw new PeerConnectionPartnerIsNotDefinedError();
		}
		if (!this.partner.username) return;
		prepareMessage(payload, this.user).then((msg: ProcessedPayload) => {
			socket.emit('MESSAGE', msg.toSend);
		});
	}

	receiveEncryptedMessage(payload: ReceiveEncryptedMessagePayload) {
		peerConnectionReceiveEncryptedMessage(this, payload);
	}

	getAvailableSources(): void {
		this.sendEncryptedMessage({
			type: 'GET_AVAILABLE_SOURCES',
			payload: {},
		});
	}

	switchSource(sourceId: string): void {
		this.sendEncryptedMessage({
			type: 'SWITCH_SOURCE',
			payload: { sourceId },
		});
	}

	sendRemoteInput(payload: {
		action: 'pointer' | 'key' | 'text' | 'macro';
		pointer?: {
			type: 'tap' | 'click' | 'move' | 'down' | 'up' | 'dblclick' | 'contextmenu';
			x: number;
			y: number;
			button?: 'left' | 'right' | 'middle';
		};
		key?: string;
		text?: string;
		macro?: string;
		autoEnter?: boolean;
		sessionId?: string;
		targetTabName?: string;
		targetWindowTitle?: string;
		[key: string]: unknown;
	}): void {
		const dataJSON = JSON.stringify({
			type: 'deskreen-remote-input',
			payload,
		});
		if (this.peer && !this.peer.destroyed) {
			try {
				this.peer.send(dataJSON);
				return;
			} catch (err) {
				console.warn(
					'[PeerConnection] Failed to send remote input over RTCDataChannel:',
					err,
				);
			}
		}
		// Fallback over socket signaling if data channel is not yet open
		try {
			this.sendEncryptedMessage({
				type: 'REMOTE_CONSOLE_INPUT',
				payload,
			});
		} catch (err) {
			console.warn(
				'[PeerConnection] Failed to send fallback remote input over socket:',
				err,
			);
		}
	}

	createUserAndInitSocket() {
		if (this.isDestroyed) return;
		const socket = this.socket;
		if (!socket) {
			throw new PeerConnectionSocketNotDefined();
		}

		socket.removeAllListeners();

		this.user = this.createUser();
		peerConnectionHandleSocket(this);

		if (this.beforeunloadHandler) {
			window.removeEventListener('beforeunload', this.beforeunloadHandler);
			this.beforeunloadHandler = null;
		}

		this.beforeunloadHandler = () => {
			socket.emit('USER_DISCONNECT');
		};
		window.addEventListener('beforeunload', this.beforeunloadHandler);
	}
}
