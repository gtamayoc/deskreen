import { Button, Icon, Position, Tag, Tooltip } from '@blueprintjs/core';
import { SettingsContext } from '@renderer/contexts/SettingsContext';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { IpcEvents } from '../../../common/IpcEvents.enum';
import ConnectedDevicesListDrawer from './ConnectedDevicesListDrawer';
import SettingsOverlay from './SettingsOverlay/SettingsOverlay';
import classes from './TopPanel.module.css';

interface Props {
	handleReset: () => void;
}

export default function TopPanel({ handleReset }: Props): React.ReactElement {
	const { t } = useTranslation();
	const { isDarkMode, toggleDarkMode } = React.useContext(SettingsContext);

	const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
	const [isConnectedDevicesDrawerOpen, setIsConnectedDevicesDrawerOpen] =
		React.useState(false);
	const [latestVersion, setLatestVersion] = React.useState('');
	const [currentVersion, setCurrentVersion] = React.useState('');
	const [connectedDevicesCount, setConnectedDevicesCount] = React.useState(0);

	const handleSettingsOpen = React.useCallback(() => {
		setIsSettingsOpen(true);
	}, []);

	const handleSettingsClose = React.useCallback(() => {
		setIsSettingsOpen(false);
	}, []);

	const handleToggleConnectedDevicesListDrawer = React.useCallback(() => {
		setIsConnectedDevicesDrawerOpen(!isConnectedDevicesDrawerOpen);
	}, [isConnectedDevicesDrawerOpen]);

	const handleTutorialButtonClick = React.useCallback(() => {
		window.electron.ipcRenderer.invoke(
			IpcEvents.OpenExternalLink,
			'https://deskreen.com/howto',
		);
	}, []);

	const handleOpenDownloadPage = React.useCallback((): void => {
		void window.electron.ipcRenderer.invoke(
			IpcEvents.OpenExternalLink,
			'https://deskreen.com/download',
		);
	}, []);

	React.useEffect(() => {
		const fetchVersions = async (): Promise<void> => {
			const [latest, current] = await Promise.all([
				window.electron.ipcRenderer.invoke('get-latest-version'),
				window.electron.ipcRenderer.invoke('get-current-version'),
			]);
			if (typeof latest === 'string') {
				setLatestVersion(latest);
			}
			if (typeof current === 'string') {
				setCurrentVersion(current);
			}
		};

		void fetchVersions();
	}, []);

	React.useEffect(() => {
		const fetchConnectedDevicesCount = async (): Promise<void> => {
			try {
				const devices = await window.electron.ipcRenderer.invoke(
					IpcEvents.GetConnectedDevices,
				);
				if (Array.isArray(devices)) {
					setConnectedDevicesCount(devices.length);
				}
			} catch (e) {
				console.error(e);
			}
		};

		void fetchConnectedDevicesCount();

		const handleDeviceUpdate = (): void => {
			void fetchConnectedDevicesCount();
		};

		window.electron.ipcRenderer.on(
			IpcEvents.ViewerConnectionAvailabilityChanged,
			handleDeviceUpdate,
		);
		window.electron.ipcRenderer.on(
			IpcEvents.SetPendingConnectionDevice,
			handleDeviceUpdate,
		);

		const connectedDevicesInterval = setInterval(
			fetchConnectedDevicesCount,
			2000,
		);

		return () => {
			clearInterval(connectedDevicesInterval);
			window.electron.ipcRenderer.removeListener(
				IpcEvents.ViewerConnectionAvailabilityChanged,
				handleDeviceUpdate,
			);
			window.electron.ipcRenderer.removeListener(
				IpcEvents.SetPendingConnectionDevice,
				handleDeviceUpdate,
			);
		};
	}, []);

	const hasUpdate =
		latestVersion !== '' &&
		currentVersion !== '' &&
		latestVersion !== currentVersion;

	const renderConnectedDevicesListButton = (
		<div className={classes.topPanelControlButtonMargin}>
			<Tooltip content={t('connected-devices')} position={Position.BOTTOM}>
				<Button
					id="top-panel-connected-devices-list-button"
					intent="primary"
					className={classes.topPanelControlButton}
					onClick={handleToggleConnectedDevicesListDrawer}
				>
					<Icon
						className={classes.topPanelIconOfControlButton}
						icon="th-list"
						size={20}
					/>
				</Button>
			</Tooltip>
			{connectedDevicesCount > 0 && (
				<span className={classes.connectedDevicesBadge}>
					{connectedDevicesCount}
				</span>
			)}
		</div>
	);

	const renderTutorialButton = (
		<div className={classes.topPanelControlButtonMargin}>
			<Tooltip content={t('tutorial')} position={Position.BOTTOM}>
				<Button
					id="top-panel-tutorial-button"
					className={classes.topPanelControlButton}
					onClick={handleTutorialButtonClick}
				>
					<Icon
						className={classes.topPanelIconOfControlButton}
						icon="learning"
						size={22}
					/>
				</Button>
			</Tooltip>
		</div>
	);

	const renderHelpButton = (
		<div className={classes.topPanelControlButtonMargin}>
			<Tooltip content={t('fix-reset-tooltip')} position={Position.BOTTOM}>
				<Button
					id="top-panel-help-button"
					intent="danger"
					className={classes.topPanelControlButton}
					onClick={() => {
						Promise.resolve(handleReset()).then(() => {
							window.electron.ipcRenderer.invoke(
								IpcEvents.CreateWaitingForConnectionSharingSession,
							);
						});
					}}
				>
					<Icon
						className={classes.topPanelIconOfControlButton}
						icon="lifesaver"
						size={22}
					/>
				</Button>
			</Tooltip>
		</div>
	);

	const renderSettingsButton = (
		<div className={classes.topPanelControlButtonMargin}>
			<Tooltip content={t('settings')} position={Position.BOTTOM}>
				<Button
					id="top-panel-settings-button"
					onClick={handleSettingsOpen}
					className={classes.topPanelControlButton}
				>
					<Icon
						className={classes.topPanelIconOfControlButton}
						icon="cog"
						size={22}
					/>
				</Button>
			</Tooltip>
		</div>
	);

	const renderDarkModeButton = (
		<div className={classes.topPanelControlButtonMargin}>
			<Tooltip
				content={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
				position={Position.BOTTOM}
			>
				<Button
					id="top-panel-dark-mode-button"
					onClick={toggleDarkMode}
					className={classes.topPanelControlButton}
				>
					<Icon
						className={classes.topPanelIconOfControlButton}
						icon={isDarkMode ? 'flash' : 'moon'}
						size={20}
					/>
				</Button>
			</Tooltip>
		</div>
	);

	return (
		<>
			<div className={classes.topPanelRoot}>
				<div className={classes.topPanelControlsWrapper}>
					<div className={classes.topPanelControlButtonsRoot}>
						{renderConnectedDevicesListButton}
						{renderDarkModeButton}
						{renderHelpButton}
						{renderTutorialButton}
						{renderSettingsButton}
					</div>
					{hasUpdate ? (
						<Tag
							minimal
							intent="success"
							round
							className={classes.updateBadge}
							role="button"
							onClick={handleOpenDownloadPage}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									handleOpenDownloadPage();
								}
							}}
							tabIndex={0}
						>
							{t('new-version-available')}
						</Tag>
					) : null}
				</div>
			</div>
			{isSettingsOpen ? (
				<SettingsOverlay
					isSettingsOpen={isSettingsOpen}
					handleClose={handleSettingsClose}
				/>
			) : (
				<></>
			)}
			{isConnectedDevicesDrawerOpen ? (
				<ConnectedDevicesListDrawer
					isOpen={isConnectedDevicesDrawerOpen}
					handleToggle={handleToggleConnectedDevicesListDrawer}
					handleReset={handleReset}
				/>
			) : (
				<></>
			)}
		</>
	);
}
