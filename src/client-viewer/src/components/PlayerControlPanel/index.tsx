import React, { useEffect, useState, useCallback } from 'react';
import {
	Alignment,
	Button,
	ButtonGroup,
	Card,
	H5,
	Switch,
	Divider,
	Text,
	Icon,
	Tooltip,
	Position,
	Popover,
	Classes,
} from '@blueprintjs/core';
import screenfull from 'screenfull';
import { useTranslation } from 'react-i18next';
import FullScreenEnter from '../../images/fullscreen_24px.svg';
import FullScreenExit from '../../images/fullscreen_exit-24px.svg';
import { Col, Row } from 'react-flexbox-grid';
import {
	VideoQuality,
	type VideoQualityType,
} from '../../features/VideoAutoQualityOptimizer/VideoQualityEnum';
import { handlePlayerToggleFullscreen } from './handlePlayerToggleFullscreen';
import initScreenfullOnChange from './initScreenfullOnChange';
import { ScreenSharingSource } from '../../features/PeerConnection/ScreenSharingSourceEnum';
import {
	trackAnalyticsEvent,
	setConsentStatus,
	updateAnalyticsConsent,
} from '../../utils/analytics';
import PrivacyControlDialog from '../PrivacyControlDialog';
import './index.css';

const videoQualityButtonStyle: React.CSSProperties = {
	width: '100%',
	display: 'flex',
	justifyContent: 'center',
	alignItems: 'center',
	textAlign: 'center',
	minHeight: '40px',
};

interface PlayerControlPanelProps {
	onSwitchChangedCallback: (isEnabled: boolean) => void;
	isPlaying: boolean;
	isDefaultPlayerTurnedOn: boolean;
	handleClickFullscreen: () => 'entered' | 'exited' | 'failed';
	handleClickPlayPause: () => void;
	setVideoQuality: (q: VideoQualityType) => void;
	selectedVideoQuality: VideoQualityType;
	screenSharingSourceType: ScreenSharingSourceType;
	isFlippedHorizontal?: boolean;
	onToggleFlip?: () => void;
	isDarkMode?: boolean;
	onToggleDarkMode?: () => void;
	onResetVisualSettings?: () => void;
	onOpenSourceSwitcher?: () => void;
	videoRotation?: number;
	onToggleOrientation?: () => void;
	// toaster: undefined | HTMLDivElement;
}

function PlayerControlPanel(props: PlayerControlPanelProps) {
	const { t } = useTranslation();
	const {
		onSwitchChangedCallback,
		isPlaying,
		isDefaultPlayerTurnedOn,
		handleClickPlayPause,
		handleClickFullscreen,
		selectedVideoQuality,
		setVideoQuality,
		screenSharingSourceType,
		isFlippedHorizontal,
		onToggleFlip,
		isDarkMode,
		onToggleDarkMode,
		onResetVisualSettings,
		onOpenSourceSwitcher,
		videoRotation = 0,
		onToggleOrientation,
	} = props;

	const isFullScreenAPIAvailable = screenfull.isEnabled;

	const [isFullScreenOn, setIsFullScreenOn] = useState(false);
	const [isPrivacyDialogOpen, setIsPrivacyDialogOpen] = useState(false);

	useEffect(() => {
		const cleanup = initScreenfullOnChange(setIsFullScreenOn);
		return cleanup;
	}, []);

	const handleClickFullscreenWhenDefaultPlayerIsOn = useCallback(() => {
		const result = handlePlayerToggleFullscreen();
		if (result === 'failed') {
			console.warn('Unable to toggle fullscreen');
			return result;
		}
		setIsFullScreenOn(result === 'entered');
		return result;
	}, [setIsFullScreenOn]);

	const handlePlayPauseClick = useCallback(() => {
		const nextAction = isPlaying ? 'pause' : 'play';
		trackAnalyticsEvent(
			nextAction === 'play' ? 'play_button_clicked' : 'pause_button_clicked',
			{
				target_state: nextAction === 'play' ? 'playing' : 'paused',
			},
		);
		handleClickPlayPause();
	}, [handleClickPlayPause, isPlaying]);

	const handleVideoQualitySelect = useCallback(
		(quality: VideoQualityType) => {
			if (selectedVideoQuality !== quality) {
				trackAnalyticsEvent('video_quality_selected', {
					quality,
				});
			}
			setVideoQuality(quality);
		},
		[selectedVideoQuality, setVideoQuality],
	);

	const handleDefaultPlayerToggle = useCallback(() => {
		const nextState = !isDefaultPlayerTurnedOn;
		trackAnalyticsEvent('default_player_toggled', {
			state: nextState ? 'on' : 'off',
		});
		onSwitchChangedCallback(nextState);
	}, [isDefaultPlayerTurnedOn, onSwitchChangedCallback]);

	const handleFullscreenClick = useCallback(() => {
		const result = isDefaultPlayerTurnedOn
			? handleClickFullscreenWhenDefaultPlayerIsOn()
			: handleClickFullscreen();
		if (result === 'failed') {
			trackAnalyticsEvent('fullscreen_toggle_failed', {
				player_mode: isDefaultPlayerTurnedOn ? 'default' : 'custom',
			});
			return;
		}
		trackAnalyticsEvent('fullscreen_toggled', {
			state: result === 'entered' ? 'on' : 'off',
			player_mode: isDefaultPlayerTurnedOn ? 'default' : 'custom',
		});
	}, [
		handleClickFullscreen,
		handleClickFullscreenWhenDefaultPlayerIsOn,
		isDefaultPlayerTurnedOn,
	]);

	const handlePrivacyControlClick = useCallback(() => {
		setIsPrivacyDialogOpen(true);
	}, []);

	const handlePrivacyDialogClose = useCallback(() => {
		setIsPrivacyDialogOpen(false);
	}, []);

	const handlePrivacyAccept = useCallback(() => {
		setConsentStatus('accepted');
		updateAnalyticsConsent('accepted');
		setIsPrivacyDialogOpen(false);
	}, []);

	const handlePrivacyOptOut = useCallback(() => {
		setConsentStatus('opted-out');
		updateAnalyticsConsent('opted-out');
		setIsPrivacyDialogOpen(false);
	}, []);

	return (
		<>
			<PrivacyControlDialog
				isOpen={isPrivacyDialogOpen}
				onClose={handlePrivacyDialogClose}
				onAccept={handlePrivacyAccept}
				onOptOut={handlePrivacyOptOut}
			/>
			<Card elevation={4} className="player-control-panel-card">
				<Row between="xs" middle="xs">
					<Col xs={12} md={7}>
						<Row center="xs" start="md" style={{ height: '42px' }}>
							<ButtonGroup
								style={{
									borderRadius: '20px',
									backgroundColor: '#137CBD',
									height: '42px',
								}}
							>
								<Tooltip
									content={
										isPlaying
											? t('Click to Pause Video')
											: t('Click to Play Video')
									}
									position={Position.BOTTOM}
								>
									<Button
										minimal
										onClick={handlePlayPauseClick}
										style={{
											color: 'white',
											backgroundColor: !isPlaying
												? 'rgba(255, 255, 255, 0.2)'
												: 'transparent',
											boxShadow: !isPlaying
												? '0 0 20px rgba(19, 124, 189, 0.8), 0 0 40px rgba(19, 124, 189, 0.6)'
												: 'none',
											transition: 'all 0.3s ease-in-out',
											border: 'none',
											outline: 'none',
											boxSizing: 'border-box',
											padding: '0 20px',
											borderRadius: '20px 0 0 20px',
											width: '120px',
											minWidth: '120px',
											maxWidth: '120px',
										}}
										className={
											!isPlaying
												? 'play-pause-button play-pause-button-glow'
												: 'play-pause-button'
										}
									>
										<span
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: '6px',
											}}
										>
											<Icon icon={isPlaying ? 'pause' : 'play'} color="white" />
											<Text
												className="bp3-text-large play-pause-text"
												style={{ color: 'white' }}
											>
												{isPlaying ? t('Pause') : t('Play')}
											</Text>
										</span>
									</Button>
								</Tooltip>
								{onOpenSourceSwitcher && (
									<Tooltip
										content={t('Cambiar Pantalla o Ventana')}
										position={Position.BOTTOM}
									>
										<Button
											minimal
											onClick={onOpenSourceSwitcher}
											style={{
												color: 'white',
												outline: 'none',
												boxShadow: 'none',
												borderRadius: '0',
												padding: '0 16px',
											}}
											className="settings-button-separator"
										>
											<Icon icon="desktop" color="white" />
										</Button>
									</Tooltip>
								)}
								<Popover
									content={
										<>
											<H5>{`${t('Video Settings')}:`}</H5>
											<Divider />
											<Row
												style={{
													justifyContent: 'center',
													marginBottom: '6px',
												}}
											>
												<Tooltip
													content={t(
														'Modo Teleprompter (Voltear horizontalmente)',
													)}
													position={Position.TOP}
												>
													<span
														style={{
															display: 'block',
															width: '100%',
															textAlign: 'center',
														}}
													>
														<Button
															icon="key-tab"
															minimal
															active={isFlippedHorizontal}
															style={videoQualityButtonStyle}
															onClick={onToggleFlip}
														>
															{isFlippedHorizontal
																? `${t('Flip')} (ON)`
																: t('Flip')}
														</Button>
													</span>
												</Tooltip>
											</Row>

											<Row
												style={{
													justifyContent: 'center',
													marginBottom: '6px',
												}}
											>
												<Tooltip
													content={t('Alternar Modo Oscuro')}
													position={Position.TOP}
												>
													<span
														style={{
															display: 'block',
															width: '100%',
															textAlign: 'center',
														}}
													>
														<Button
															icon={isDarkMode ? 'flash' : 'moon'}
															minimal
															active={isDarkMode}
															style={videoQualityButtonStyle}
															onClick={onToggleDarkMode}
														>
															{isDarkMode ? 'Modo Oscuro (ON)' : 'Modo Oscuro'}
														</Button>
													</span>
												</Tooltip>
											</Row>
											{onToggleOrientation && (
												<Row
													style={{
														justifyContent: 'center',
														marginBottom: '6px',
													}}
												>
													<Tooltip
														content={t('Girar Pantalla (Rotar orientación)')}
														position={Position.TOP}
													>
														<span
															style={{
																display: 'block',
																width: '100%',
																textAlign: 'center',
															}}
														>
															<Button
																icon="mobile-phone"
																minimal
																active={Boolean(
																	videoRotation && videoRotation > 0,
																)}
																style={videoQualityButtonStyle}
																onClick={onToggleOrientation}
															>
																{videoRotation && videoRotation > 0
																	? `${t('Girar Pantalla')} (${videoRotation}°)`
																	: t('Girar Pantalla')}
															</Button>
														</span>
													</Tooltip>
												</Row>
											)}
											<Row
												style={{
													justifyContent: 'center',
													marginBottom: '6px',
												}}
											>
												<Tooltip
													content={t(
														'Restablecer orientación y espejo a valores predeterminados',
													)}
													position={Position.TOP}
												>
													<span
														style={{
															display: 'block',
															width: '100%',
															textAlign: 'center',
														}}
													>
														<Button
															icon="history"
															minimal
															style={videoQualityButtonStyle}
															onClick={onResetVisualSettings}
														>
															{t('Restablecer vista')}
														</Button>
													</span>
												</Tooltip>
											</Row>
											<Divider />
											{Object.values(VideoQuality).map(
												(q: VideoQualityType) => {
													return (
														<Row key={q}>
															<Button
																minimal
																active={selectedVideoQuality === q}
																style={videoQualityButtonStyle}
																disabled={
																	screenSharingSourceType ===
																	ScreenSharingSource.WINDOW
																}
																onClick={() => {
																	handleVideoQualitySelect(q);
																	// toaster?.show({
																	//   icon: 'clean',
																	//   intent: Intent.PRIMARY,
																	//   message: `${t(
																	//     'Video quality has been changed to'
																	//   )} ${q}`,
																	// });
																}}
															>
																{q}
															</Button>
														</Row>
													);
												},
											)}
										</>
									}
									position={Position.BOTTOM}
									popoverClassName={Classes.POPOVER_CONTENT_SIZING}
								>
									<Tooltip
										content={t('Click to Open Video Settings')}
										position={Position.BOTTOM}
									>
										<Button
											minimal
											style={{
												color: 'white',
												outline: 'none',
												boxShadow: 'none',
												borderRadius: '0',
												padding: '0 20px',
											}}
											className="settings-button-separator"
										>
											<Icon icon="cog" color="white" />
										</Button>
									</Tooltip>
								</Popover>
								{onToggleOrientation && (
									<Tooltip
										content={t('Girar Pantalla (Rotar orientación)')}
										position={Position.BOTTOM}
									>
										<Button
											minimal
											onClick={onToggleOrientation}
											style={{
												color: 'white',
												outline: 'none',
												boxShadow: 'none',
												borderRadius: '0',
												padding: '0 16px',
											}}
											className="settings-button-separator"
											title={t('Girar Pantalla')}
											aria-label={t('Girar Pantalla')}
										>
											<span
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: '4px',
												}}
											>
												<Icon icon="mobile-phone" color="white" />
												{videoRotation && videoRotation > 0 ? (
													<span className="rotation-degree-badge">
														{videoRotation}°
													</span>
												) : null}
											</span>
										</Button>
									</Tooltip>
								)}
								<Tooltip
									content={t('Click to Enter Full Screen Mode')}
									position={Position.BOTTOM}
								>
									<Button
										minimal
										onClick={handleFullscreenClick}
										style={{
											color: 'white',
											border: 'none',
											outline: 'none',
											boxShadow: 'none',
											borderRadius: '0 20px 20px 0',
											padding: '0 20px',
										}}
									>
										<img
											src={isFullScreenOn ? FullScreenExit : FullScreenEnter}
											width={16}
											height={16}
											style={{
												transform: 'scale(1.5) translateY(1px)',
												filter:
													'invert(100%) sepia(100%) saturate(0%) hue-rotate(127deg) brightness(107%) contrast(102%)',
											}}
											alt="fullscreen-toggle"
										/>
									</Button>
								</Tooltip>
							</ButtonGroup>
						</Row>
					</Col>
					<Col xs={12} md={5}>
						<Row end="xs" middle="xs">
							<Col xs={12}>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'flex-end',
										gap: '12px',
										flexWrap: 'wrap',
									}}
								>
									<Switch
										onChange={handleDefaultPlayerToggle}
										innerLabel={isDefaultPlayerTurnedOn ? t('ON') : t('OFF')}
										inline
										label={t('Default Video Player')}
										alignIndicator={Alignment.RIGHT}
										checked={isDefaultPlayerTurnedOn}
										disabled={!isFullScreenAPIAvailable}
										style={{
											marginBottom: '0px',
										}}
									/>
									{onToggleDarkMode && (
										<Button
											minimal
											icon={isDarkMode ? 'flash' : 'moon'}
											onClick={onToggleDarkMode}
											title={
												isDarkMode
													? (t('Modo Claro') as string)
													: (t('Modo Oscuro') as string)
											}
											aria-label={
												isDarkMode
													? 'Cambiar a modo claro'
													: 'Cambiar a modo oscuro'
											}
											style={{
												color: 'var(--text-color, #182026)',
												minHeight: '40px',
												minWidth: '40px',
												display: 'inline-flex',
												alignItems: 'center',
												justifyContent: 'center',
											}}
										/>
									)}
									<Button
										minimal
										icon="shield"
										onClick={handlePrivacyControlClick}
										style={{
											color: 'var(--text-muted-color, #5C7080)',
											minHeight: '40px',
											display: 'inline-flex',
											alignItems: 'center',
										}}
									>
										{t('Privacy Settings')}
									</Button>
								</div>
							</Col>
						</Row>
					</Col>
				</Row>
			</Card>
		</>
	);
}

export default PlayerControlPanel;
