import { useEffect, useRef, useCallback, useState } from 'react';
import { OverlayToaster, Position } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import VideoJSPlayer from '../../components/VideoJSPlayer';
import PlayerControlPanel from '../../components/PlayerControlPanel';
import {
	COMPARISON_CANVAS_ID,
	PLAYER_WRAPPER_ID,
} from '../../constants/appConstants';
import { type VideoQualityType } from '../../features/VideoAutoQualityOptimizer/VideoQualityEnum';
import {
	togglePlayerFullscreen,
	isPlayerFullscreen,
	enterPlayerFullscreen,
	exitPlayerFullscreen,
	subscribeToPlayerFullscreenChange,
} from '../../utils/playerFullscreen';
import {
	toggleOrientation,
	isOrientationLockSupported,
} from '../../utils/screenOrientation';
import ConsoleActionPad from '../../components/ConsoleActionPad';
import FullscreenOverlayHUD from '../../components/FullscreenOverlayHUD';
import SourceSwitcherModal from '../../components/SourceSwitcherModal';
import ResumeFullscreenButton from '../../components/ResumeFullscreenButton';
import { useTheme } from '../../providers/ThemeProvider';
import type PeerConnection from '../../features/PeerConnection';

interface PlayerViewProps {
	isWithControls: boolean;
	setIsWithControls: (_: boolean) => void;
	handlePlayPause: () => void;
	isPlaying: boolean;
	setPlaying: (playing: boolean) => void;
	setVideoQuality: (_: VideoQualityType) => void;
	videoQuality: VideoQualityType;
	screenSharingSourceType: ScreenSharingSourceType;
	streamUrl: MediaStream | null;
	peer?: PeerConnection;
	isConsoleSharing?: boolean;
}

type IOSVideoElement = HTMLVideoElement & {
	webkitEnterFullscreen?: () => void;
	webkitExitFullscreen?: () => void;
	webkitSupportsFullscreen?: boolean;
	webkitDisplayingFullscreen?: boolean;
};

function PlayerView(props: PlayerViewProps) {
	const { t } = useTranslation();
	const {
		screenSharingSourceType,
		setIsWithControls,
		isWithControls,
		handlePlayPause,
		isPlaying,
		setPlaying,
		setVideoQuality,
		videoQuality,
		streamUrl,
		peer,
		isConsoleSharing = false,
	} = props;

	const [isFlippedHorizontal, setIsFlippedHorizontal] = useState(() => {
		return localStorage.getItem('deskreen_flip_horizontal') === 'true';
	});
	const [videoRotation, setVideoRotation] = useState<number>(() => {
		try {
			const saved = localStorage.getItem('deskreen_rotation');
			if (saved) {
				const parsed = parseInt(saved, 10);
				if ([0, 90, 180, 270].includes(parsed)) {
					return parsed;
				}
			}
		} catch {
			// ignore
		}
		return 0;
	});
	const BRIGHTNESS_LEVELS = [1.0, 0.75, 0.5, 0.3];
	const [screenBrightness, setScreenBrightness] = useState<number>(() => {
		const saved = localStorage.getItem('deskreen_screen_brightness');
		if (saved) {
			const parsed = parseFloat(saved);
			if (BRIGHTNESS_LEVELS.includes(parsed)) {
				return parsed;
			}
		}
		return 1.0;
	});
	const { isDarkMode, toggleDarkMode } = useTheme();
	const [isFullscreen, setIsFullscreen] = useState(() => isPlayerFullscreen());
	const [isAIPadOpen, setIsAIPadOpen] = useState(false);
	const [isSourceSwitcherOpen, setIsSourceSwitcherOpen] = useState(false);

	const videoContainerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState<{
		width: number;
		height: number;
	}>({
		width: 0,
		height: 0,
	});

	useEffect(() => {
		try {
			localStorage.setItem('deskreen_rotation', String(videoRotation));
		} catch {
			// ignore
		}
	}, [videoRotation]);

	useEffect(() => {
		const el = videoContainerRef.current;
		if (!el) return;

		const updateSize = () => {
			if (el) {
				setContainerSize({ width: el.clientWidth, height: el.clientHeight });
			}
		};
		updateSize();

		const ro = new ResizeObserver(() => updateSize());
		ro.observe(el);
		window.addEventListener('resize', updateSize);

		return () => {
			ro.disconnect();
			window.removeEventListener('resize', updateSize);
		};
	}, []);

	useEffect(() => {
		if (!isConsoleSharing) {
			setIsAIPadOpen(false);
		}
	}, [isConsoleSharing]);

	const [showResumeFullscreen, setShowResumeFullscreen] = useState(false);
	const prevStreamUrlRef = useRef<MediaStream | null>(null);

	useEffect(() => {
		const unsubscribe = subscribeToPlayerFullscreenChange((fullscreen) => {
			setIsFullscreen(fullscreen);
			if (fullscreen) {
				setShowResumeFullscreen(false);
				try {
					localStorage.setItem('deskreen_was_fullscreen', 'true');
				} catch {
					// ignore
				}
			} else if (!peer?.isReconnecting) {
				// Deliberate user exit during normal playback (not caused by cable/socket reconnection)
				try {
					localStorage.removeItem('deskreen_was_fullscreen');
				} catch {
					// ignore
				}
			}
		});
		return () => {
			unsubscribe();
		};
	}, [peer]);

	useEffect(() => {
		const prev = prevStreamUrlRef.current;
		prevStreamUrlRef.current = streamUrl;

		// When stream is restored/received, check if viewer was in fullscreen mode before disconnect
		if (
			streamUrl &&
			(!prev || prev !== streamUrl || !prev.active || peer?.isReconnecting)
		) {
			let wasFullscreen = false;
			try {
				wasFullscreen =
					localStorage.getItem('deskreen_was_fullscreen') === 'true';
			} catch {
				// ignore
			}
			if (wasFullscreen && !isPlayerFullscreen()) {
				setShowResumeFullscreen(true);
			}
		}
	}, [streamUrl, peer]);

	useEffect(() => {
		localStorage.setItem(
			'deskreen_flip_horizontal',
			String(isFlippedHorizontal),
		);
	}, [isFlippedHorizontal]);

	useEffect(() => {
		localStorage.setItem(
			'deskreen_screen_brightness',
			String(screenBrightness),
		);
	}, [screenBrightness]);

	const handleToggleFlip = useCallback(() => {
		setIsFlippedHorizontal((prev) => !prev);
	}, []);

	const handleCycleBrightness = useCallback(() => {
		setScreenBrightness((prev) => {
			const idx = BRIGHTNESS_LEVELS.indexOf(prev);
			const nextIdx =
				idx === -1 || idx === BRIGHTNESS_LEVELS.length - 1 ? 0 : idx + 1;
			return BRIGHTNESS_LEVELS[nextIdx];
		});
	}, []);

	const handleResetVisualSettings = useCallback(() => {
		setIsFlippedHorizontal(false);
		setScreenBrightness(1.0);
		setVideoRotation(0);
		localStorage.setItem('deskreen_flip_horizontal', 'false');
		localStorage.setItem('deskreen_rotation', '0');
		localStorage.removeItem('deskreen_screen_brightness');
	}, []);

	// const player = useRef(null);

	const videoRef = useRef<HTMLVideoElement>(null);
	const toasterRef = useRef<Awaited<
		ReturnType<typeof OverlayToaster.create>
	> | null>(null);
	// no external player ref needed for video.js variant

	useEffect(() => {
		if (!streamUrl) return;

		// html5 video mode
		if (isWithControls && videoRef.current) {
			if (streamUrl instanceof MediaStream) {
				videoRef.current.srcObject = streamUrl;
			} else {
				videoRef.current.src = streamUrl;
			}
			videoRef.current.play().catch((error) => {
				console.error('Error playing video:', error);
			});
			return;
		}

		// video.js mode (default) doesn't need imperative src assignment here
	}, [streamUrl, isWithControls]);

	useEffect(() => {
		if (isWithControls) {
			if (!videoRef.current) return;
			if (isPlaying) {
				videoRef.current.play().catch((error) => {
					console.error('Error playing video:', error);
				});
			} else {
				videoRef.current.pause();
			}
		}
		// react-player play/pause is handled via its `playing` prop
	}, [isPlaying, isWithControls]);

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (
				typeof document !== 'undefined' &&
				document.visibilityState === 'visible' &&
				isPlaying &&
				isWithControls &&
				videoRef.current
			) {
				if (videoRef.current.paused) {
					videoRef.current.play().catch(() => {
						// ignore autoplay error
					});
				}
			}
		};

		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', handleVisibilityChange);
		}
		return () => {
			if (typeof document !== 'undefined') {
				document.removeEventListener(
					'visibilitychange',
					handleVisibilityChange,
				);
			}
		};
	}, [isPlaying, isWithControls]);

	// initialize toaster
	useEffect(() => {
		const initToaster = async () => {
			if (!toasterRef.current) {
				toasterRef.current = await OverlayToaster.create({
					position: Position.BOTTOM,
				});
			}
		};
		initToaster();
	}, []);

	// wrap handlePlayPause to show toaster notifications
	const handlePlayPauseWithNotification = useCallback(() => {
		const nextPlaying = !isPlaying;
		handlePlayPause();

		// show notification after a small delay to ensure state is updated
		setTimeout(() => {
			if (toasterRef.current) {
				toasterRef.current.show({
					message: nextPlaying
						? t('Video stream is playing')
						: t('Video stream is paused'),
					intent: nextPlaying ? 'success' : 'warning',
					timeout: 2000,
				});
			}
		}, 50);
	}, [handlePlayPause, isPlaying, t]);

	const handleToggleOrientation = useCallback(async () => {
		// If in fullscreen and orientation lock is supported, try native lock
		if (isPlayerFullscreen() && isOrientationLockSupported()) {
			const result = await toggleOrientation();
			if (result !== 'unsupported') {
				if (toasterRef.current) {
					toasterRef.current.show({
						message: `${t('Orientación de pantalla:')} ${result === 'landscape' ? t('Horizontal') : t('Vertical')}`,
						intent: 'primary',
						timeout: 2000,
					});
				}
				return;
			}
		}

		// Otherwise (before fullscreen or when native lock is not allowed), rotate the video view
		setVideoRotation((prev) => {
			const next = (prev + 90) % 360;
			if (toasterRef.current) {
				const labels: { [k: number]: string } = {
					0: t('Normal (0°)'),
					90: t('Horizontal (90°)'),
					180: t('Invertido (180°)'),
					270: t('Horizontal invertido (270°)'),
				};
				toasterRef.current.show({
					message: `${t('Girar Pantalla:')} ${labels[next] || `${next}°`}`,
					intent: 'primary',
					timeout: 2000,
				});
			}
			return next;
		});
	}, [t]);

	const isPointerDownRef = useRef(false);
	const activePointerIdRef = useRef<number | null>(null);
	const pointerStartPosRef = useRef<{ x: number; y: number; time: number }>({
		x: 0,
		y: 0,
		time: 0,
	});
	const lastMoveSentRef = useRef<number>(0);

	const getRelativeCoordinates = useCallback(
		(clientX: number, clientY: number) => {
			const container = videoContainerRef.current;
			if (!container) return { x: 0.5, y: 0.5 };
			const rect = container.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };

			let relX = (clientX - rect.left) / rect.width;
			let relY = (clientY - rect.top) / rect.height;

			relX = Math.max(0, Math.min(1, relX));
			relY = Math.max(0, Math.min(1, relY));

			if (videoRotation === 90) {
				const origX = relX;
				relX = relY;
				relY = 1 - origX;
			} else if (videoRotation === 180) {
				relX = 1 - relX;
				relY = 1 - relY;
			} else if (videoRotation === 270) {
				const origX = relX;
				relX = 1 - relY;
				relY = origX;
			}

			if (isFlippedHorizontal) {
				relX = 1 - relX;
			}

			return { x: relX, y: relY };
		},
		[isFlippedHorizontal, videoRotation],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				target.closest(
					'button, input, select, textarea, a, .player-control-panel, .console-action-pad, .fullscreen-hud, .bp5-dialog, .bp5-overlay, .bp5-portal',
				)
			) {
				return;
			}
			// Only allow primary active pointer to prevent multi-touch coordinate jumping
			if (activePointerIdRef.current !== null) {
				return;
			}
			activePointerIdRef.current = e.pointerId;
			isPointerDownRef.current = true;
			pointerStartPosRef.current = {
				x: e.clientX,
				y: e.clientY,
				time: Date.now(),
			};
		},
		[],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!isPointerDownRef.current) return;
			if (
				activePointerIdRef.current !== null &&
				e.pointerId !== activePointerIdRef.current
			) {
				return;
			}
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				target.closest(
					'button, input, select, textarea, a, .player-control-panel, .console-action-pad, .fullscreen-hud, .bp5-dialog, .bp5-overlay, .bp5-portal',
				)
			) {
				return;
			}

			const now = Date.now();
			if (now - lastMoveSentRef.current < 33) return;
			lastMoveSentRef.current = now;

			const dist = Math.hypot(
				e.clientX - pointerStartPosRef.current.x,
				e.clientY - pointerStartPosRef.current.y,
			);
			if (dist >= 5 && peer) {
				const { x, y } = getRelativeCoordinates(e.clientX, e.clientY);
				peer.sendRemoteInput({
					action: 'pointer',
					pointer: {
						type: 'move',
						x,
						y,
					},
				});
			}
		},
		[peer, getRelativeCoordinates],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!isPointerDownRef.current) return;
			if (
				activePointerIdRef.current !== null &&
				e.pointerId !== activePointerIdRef.current
			) {
				return;
			}
			activePointerIdRef.current = null;
			isPointerDownRef.current = false;
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				target.closest(
					'button, input, select, textarea, a, .player-control-panel, .console-action-pad, .fullscreen-hud, .bp5-dialog, .bp5-overlay, .bp5-portal',
				)
			) {
				return;
			}

			const elapsed = Date.now() - pointerStartPosRef.current.time;
			const dist = Math.hypot(
				e.clientX - pointerStartPosRef.current.x,
				e.clientY - pointerStartPosRef.current.y,
			);

			if (dist < 10 && elapsed < 500 && peer) {
				const { x, y } = getRelativeCoordinates(e.clientX, e.clientY);
				const button = e.button === 2 ? 'right' : 'left';
				peer.sendRemoteInput({
					action: 'pointer',
					pointer: {
						type: 'click',
						x,
						y,
						button,
					},
				});
			}
		},
		[peer, getRelativeCoordinates],
	);

	const handlePointerCancel = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (activePointerIdRef.current === e.pointerId) {
				activePointerIdRef.current = null;
				isPointerDownRef.current = false;
			}
		},
		[],
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				target.closest(
					'button, input, select, textarea, a, .player-control-panel, .console-action-pad, .fullscreen-hud, .bp5-dialog, .bp5-overlay, .bp5-portal',
				)
			) {
				return;
			}
			e.preventDefault();
			if (peer) {
				const { x, y } = getRelativeCoordinates(e.clientX, e.clientY);
				peer.sendRemoteInput({
					action: 'pointer',
					pointer: {
						type: 'click',
						x,
						y,
						button: 'right',
					},
				});
			}
		},
		[peer, getRelativeCoordinates],
	);

	// handle iPhone fullscreen exit - detect when video stops and auto-resume
	useEffect(() => {
		if (!streamUrl) return;

		const getVideoElement = (): IOSVideoElement | null => {
			if (isWithControls && videoRef.current) {
				return videoRef.current as IOSVideoElement;
			}
			const container = document.getElementById(PLAYER_WRAPPER_ID);
			if (!container) return null;
			const maybeVideo = container.querySelector('video');
			if (!(maybeVideo instanceof HTMLVideoElement)) return null;
			return maybeVideo as IOSVideoElement;
		};

		const handleFullscreenEnd = () => {
			// small delay to ensure video state is updated after fullscreen exit
			setTimeout(() => {
				const video = getVideoElement();
				if (!video) return;

				// check if video is paused after exiting fullscreen
				if (video.paused) {
					// sync play state - ensure button shows "Play" instead of "Pause"
					setPlaying(false);

					// show warning notification that video stopped and user needs to click play
					if (toasterRef.current) {
						toasterRef.current.show({
							message: t(
								'Video stream paused after exiting fullscreen. Please click Play to continue.',
							),
							intent: 'warning',
							timeout: 5000,
						});
					}
				} else {
					// video is playing, but state might be wrong - sync it
					if (!isPlaying) {
						setPlaying(true);
					}
				}
			}, 150);
		};

		const attachListener = (video: IOSVideoElement | null) => {
			if (video) {
				video.addEventListener('webkitendfullscreen', handleFullscreenEnd);
			}
		};

		const detachListener = (video: IOSVideoElement | null) => {
			if (video) {
				video.removeEventListener('webkitendfullscreen', handleFullscreenEnd);
			}
		};

		let currentVideo: IOSVideoElement | null = getVideoElement();
		attachListener(currentVideo);

		// watch for video element changes (especially for VideoJSPlayer)
		const container = document.getElementById(PLAYER_WRAPPER_ID);
		let observer: MutationObserver | null = null;

		if (container) {
			observer = new MutationObserver(() => {
				const newVideo = getVideoElement();
				if (newVideo !== currentVideo) {
					detachListener(currentVideo);
					currentVideo = newVideo;
					attachListener(currentVideo);
				}
			});
			observer.observe(container, { childList: true, subtree: true });
		}

		return () => {
			detachListener(currentVideo);
			if (observer) {
				observer.disconnect();
			}
		};
	}, [streamUrl, isWithControls, isPlaying, setPlaying, t]);

	// @ts-ignore
	return (
		<div
			style={{
				position: 'absolute',
				zIndex: 1,
				top: 0,
				left: 0,
				width: '100%',
				minHeight: '100%',
				height: '100dvh',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
			}}
		>
			<PlayerControlPanel
				onSwitchChangedCallback={(isEnabled) => setIsWithControls(isEnabled)}
				isDefaultPlayerTurnedOn={isWithControls}
				handleClickFullscreen={() => {
					const result = togglePlayerFullscreen();
					if (result === 'exited') {
						try {
							localStorage.removeItem('deskreen_was_fullscreen');
						} catch {
							// ignore
						}
						setShowResumeFullscreen(false);
					} else if (result === 'entered') {
						try {
							localStorage.setItem('deskreen_was_fullscreen', 'true');
						} catch {
							// ignore
						}
						setShowResumeFullscreen(false);
					} else if (result === 'failed') {
						console.warn('Unable to toggle fullscreen');
					}
					return result;
				}}
				handleClickPlayPause={handlePlayPauseWithNotification}
				isPlaying={isPlaying}
				setVideoQuality={setVideoQuality}
				selectedVideoQuality={videoQuality}
				screenSharingSourceType={screenSharingSourceType}
				isFlippedHorizontal={isFlippedHorizontal}
				onToggleFlip={handleToggleFlip}
				isDarkMode={isDarkMode}
				onToggleDarkMode={toggleDarkMode}
				onResetVisualSettings={handleResetVisualSettings}
				onOpenSourceSwitcher={() => setIsSourceSwitcherOpen(true)}
				videoRotation={videoRotation}
				onToggleOrientation={handleToggleOrientation}
			/>
			<div
				ref={videoContainerRef}
				id="video-container"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
				onContextMenu={handleContextMenu}
				style={{
					margin: '0 auto',
					position: 'relative',
					flex: 1,
					width: '100%',
					height: '100%',
					minHeight: 0,
					backgroundColor: 'black',
					overflow: 'hidden',
					touchAction: 'none',
				}}
			>
				<div
					id={PLAYER_WRAPPER_ID}
					className="player-wrapper"
					style={
						videoRotation === 90 || videoRotation === 270
							? containerSize.width > 0 && containerSize.height > 0
								? {
										position: 'absolute',
										width: `${containerSize.height}px`,
										height: `${containerSize.width}px`,
										left: '50%',
										top: '50%',
										transform: `translate(-50%, -50%) rotate(${videoRotation}deg)${isFlippedHorizontal ? ' scaleX(-1)' : ''}`,
										filter:
											screenBrightness < 1.0
												? `brightness(${screenBrightness})`
												: 'none',
										transition: 'transform 0.3s ease, filter 0.25s ease',
										backgroundColor: 'black',
									}
								: {
										position: 'relative',
										width: '100%',
										height: '100%',
										transform: `rotate(${videoRotation}deg)${isFlippedHorizontal ? ' scaleX(-1)' : ''}`,
										filter:
											screenBrightness < 1.0
												? `brightness(${screenBrightness})`
												: 'none',
										transition: 'transform 0.3s ease, filter 0.25s ease',
										backgroundColor: 'black',
									}
							: {
									position: 'relative',
									width: '100%',
									height: '100%',
									transform:
										`${isFlippedHorizontal ? 'scaleX(-1) ' : ''}${videoRotation > 0 ? `rotate(${videoRotation}deg)` : ''}`.trim() ||
										'none',
									filter:
										screenBrightness < 1.0
											? `brightness(${screenBrightness})`
											: 'none',
									transition: 'transform 0.3s ease, filter 0.25s ease',
									backgroundColor: 'black',
								}
					}
				>
					{isWithControls ? (
						<video
							ref={videoRef}
							autoPlay
							playsInline
							muted
							className="absolute top-0 left-0 w-full h-full"
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'contain',
								backgroundColor: 'black',
							}}
						/>
					) : (
						<VideoJSPlayer
							stream={streamUrl}
							playing={isPlaying}
							containerEl={document.getElementById(PLAYER_WRAPPER_ID)}
						/>
					)}
				</div>
				<canvas id={COMPARISON_CANVAS_ID} style={{ display: 'none' }}></canvas>
				{isFullscreen && (
					<FullscreenOverlayHUD
						onExitFullscreen={() => {
							try {
								localStorage.removeItem('deskreen_was_fullscreen');
							} catch {
								// ignore
							}
							setShowResumeFullscreen(false);
							exitPlayerFullscreen();
						}}
						isAIPadOpen={isAIPadOpen}
						onToggleAIPad={() => {
							setIsAIPadOpen((prev) => !prev);
						}}
						showAIPad={isConsoleSharing}
						isPlaying={isPlaying}
						onTogglePlayPause={handlePlayPauseWithNotification}
						brightness={screenBrightness}
						onCycleBrightness={handleCycleBrightness}
						onToggleOrientation={handleToggleOrientation}
						onOpenSourceSwitcher={() => setIsSourceSwitcherOpen(true)}
						isDarkMode={isDarkMode}
						onToggleDarkMode={toggleDarkMode}
					/>
				)}
				{showResumeFullscreen && !isFullscreen && (
					<ResumeFullscreenButton
						onResume={() => {
							const ok = enterPlayerFullscreen();
							if (ok) {
								setShowResumeFullscreen(false);
							}
						}}
						onDismiss={() => {
							setShowResumeFullscreen(false);
							try {
								localStorage.removeItem('deskreen_was_fullscreen');
							} catch {
								// ignore
							}
						}}
					/>
				)}
				{(isConsoleSharing || isAIPadOpen) && (
					<ConsoleActionPad
						peer={peer}
						isOpen={isAIPadOpen}
						onOpenChange={setIsAIPadOpen}
						isFullscreen={isFullscreen}
						isVisible={isConsoleSharing || isAIPadOpen}
					/>
				)}
				<SourceSwitcherModal
					isOpen={isSourceSwitcherOpen}
					onClose={() => setIsSourceSwitcherOpen(false)}
					peer={peer}
				/>
			</div>
		</div>
	);
}

export default PlayerView;
