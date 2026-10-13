import {
	Callout,
	Classes,
	H3,
	HTMLSelect,
	Icon,
	InputGroup,
	Overlay2,
	Tab,
	Tabs,
	TabsExpander,
	Text,
} from '@blueprintjs/core';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { Col, Row } from 'react-flexbox-grid';
import { useTranslation } from 'react-i18next';
import { IpcEvents } from '../../../../common/IpcEvents.enum';
import CloseOverlayButton from '../CloseOverlayButton';
import LanguageSelector from '../LanguageSelector';
import SettingRowLabelAndInput from './SettingRowLabelAndInput';
import './settings-overlay.css';

interface SettingsOverlayProps {
	isSettingsOpen: boolean;
	handleClose: () => void;
}

type SettingsOverlayClassKey =
	| 'checkboxSettings'
	| 'overlayInnerRoot'
	| 'overlayInsideFade'
	| 'absoluteCloseButton'
	| 'tabNavigationRowButton'
	| 'iconInTablLeftButton'
	| 'updateCalloutWrapper'
	| 'updateCallout';

type SettingsOverlayClassMap = Record<SettingsOverlayClassKey, string>;

const useStyles = makeStyles(() =>
	createStyles({
		checkboxSettings: { margin: '0' },
		overlayInnerRoot: { width: '90%' },
		overlayInsideFade: {
			height: '90vh',
			backgroundColor: 'var(--light-bg-color)',
		},
		absoluteCloseButton: { position: 'absolute', left: 'calc(100% - 65px)' },
		tabNavigationRowButton: {
			fontWeight: 700,
			padding: '6px 10px',
			borderRadius: '100px',
		},
		iconInTablLeftButton: { marginRight: '5px' },
		updateCalloutWrapper: {
			display: 'flex',
			justifyContent: 'center',
			marginBottom: '16px',
			width: '100%',
		},
		updateCallout: {
			cursor: 'pointer',
			boxShadow: 'none',
			display: 'inline-flex',
			flexDirection: 'column',
			gap: '4px',
			width: 'auto',
			maxWidth: '420px',
			borderRadius: '8px',
		},
	}),
);

export default function SettingsOverlay(
	props: SettingsOverlayProps,
): React.ReactElement {
	const [clientViewerPort, setClientViewerPort] = useState('80'); // Default port, can be changed later

	const { handleClose, isSettingsOpen } = props;
	const [latestVersion, setLatestVersion] = useState('');
	const [currentVersion, setCurrentVersion] = useState('');

	const { t } = useTranslation();

	const [networkInterfaces, setNetworkInterfaces] = useState<
		Array<{ name: string; address: string; isWifi: boolean }>
	>([]);
	const [selectedInterface, setSelectedInterface] = useState('auto');
	const [customPortInput, setCustomPortInput] = useState('');

	useEffect(() => {
		if (isSettingsOpen) {
			window.electron.ipcRenderer
				.invoke(IpcEvents.GetAvailableNetworkInterfaces)
				.then((interfaces) => {
					if (Array.isArray(interfaces)) {
						setNetworkInterfaces(interfaces);
					}
				})
				.catch((err) => console.error(err));

			window.electron.ipcRenderer
				.invoke(IpcEvents.GetSelectedNetworkInterface)
				.then((ip) => {
					if (typeof ip === 'string') {
						setSelectedInterface(ip);
					}
				})
				.catch((err) => console.error(err));

			window.electron.ipcRenderer
				.invoke(IpcEvents.GetCustomServerPort)
				.then((port) => {
					if (typeof port === 'string') {
						setCustomPortInput(port);
					}
				})
				.catch((err) => console.error(err));
		}
	}, [isSettingsOpen]);

	const handleInterfaceChange = useCallback(
		async (event: React.ChangeEvent<HTMLSelectElement>) => {
			const newIp = event.target.value;
			setSelectedInterface(newIp);
			await window.electron.ipcRenderer.invoke(
				IpcEvents.SetSelectedNetworkInterface,
				newIp,
			);
		},
		[],
	);

	const handleSavePort = useCallback(async () => {
		await window.electron.ipcRenderer.invoke(
			IpcEvents.SetCustomServerPort,
			customPortInput.trim(),
		);
	}, [customPortInput]);

	const classes = useStyles() as SettingsOverlayClassMap;

	const handleOpenDownload = useCallback((): void => {
		void window.electron.ipcRenderer.invoke(
			IpcEvents.OpenExternalLink,
			'https://deskreen.com/download',
		);
	}, []);

	const handleUpdateCalloutKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				handleOpenDownload();
			}
		},
		[handleOpenDownload],
	);

	useEffect(() => {
		window.electron.ipcRenderer
			.invoke(IpcEvents.GetPort)
			.then((port) => {
				return setClientViewerPort(port);
			})
			.catch((error) => {
				console.error('Error getting port:', error);
			});

		return () => {
			window.electron.ipcRenderer.removeListener(
				'settings-overlay-close',
				handleClose,
			);
		};
	}, [handleClose]);

	useEffect(() => {
		const getLatestVersion = async (): Promise<void> => {
			const gotLatestVersion =
				await window.electron.ipcRenderer.invoke('get-latest-version');
			if (gotLatestVersion !== '') {
				setLatestVersion(gotLatestVersion);
			}
		};
		getLatestVersion();
		const getCurrentVersion = async (): Promise<void> => {
			const gotCurrentVersion = await window.electron.ipcRenderer.invoke(
				'get-current-version',
			);
			if (gotCurrentVersion !== '') {
				setCurrentVersion(gotCurrentVersion);
			}
		};
		getCurrentVersion();
	}, []);

	const hasUpdate =
		latestVersion !== '' &&
		currentVersion !== '' &&
		latestVersion !== currentVersion;

	const GeneralSettingsPanel: React.FC = () => {
		return (
			<div style={{ width: '100%' }}>
				{hasUpdate ? (
					<div className={classes.updateCalloutWrapper}>
						<Callout
							className={classes.updateCallout}
							icon="automatic-updates"
							intent="success"
							role="button"
							tabIndex={0}
							onClick={handleOpenDownload}
							onKeyDown={handleUpdateCalloutKeyDown}
						>
							<Text style={{ fontWeight: 600 }}>
								{t('deskreen-ce-update-is-available')}
							</Text>
							<Text>{`${t('your-current-version-is')} ${currentVersion}`}</Text>
							<Text>{`${t('click-to-download-new-updated-version')} ${latestVersion}`}</Text>
						</Callout>
					</div>
				) : null}
				<Row middle="xs">
					<H3 className="bp3-text-muted">{t('general-settings')}</H3>
				</Row>

				{/*<SettingRowLabelAndInput*/}
				{/*  icon="style"*/}
				{/*  label={t('color-theme')}*/}
				{/*  input={<ToggleThemeBtnGroup />}*/}
				{/*/>*/}
				<div style={{ marginTop: '24px' }}>
					<SettingRowLabelAndInput
						icon="translate"
						label={t('language')}
						input={<LanguageSelector />}
					/>
				</div>
				<div style={{ marginTop: '24px' }}>
					<SettingRowLabelAndInput
						icon="globe"
						label="Adaptador de Red (IP)"
						input={
							<HTMLSelect
								value={selectedInterface}
								onChange={handleInterfaceChange}
								style={{ minWidth: '220px' }}
							>
								<option value="auto">Automático (Recomendado)</option>
								{networkInterfaces.map((item) => (
									<option key={item.address} value={item.address}>
										{`${item.name} (${item.address})${item.isWifi ? ' [Wi-Fi]' : ''}`}
									</option>
								))}
							</HTMLSelect>
						}
					/>
				</div>
				<div style={{ marginTop: '24px' }}>
					<SettingRowLabelAndInput
						icon="numerical"
						label="Puerto del Servidor"
						input={
							<InputGroup
								placeholder={clientViewerPort || '3131'}
								value={customPortInput}
								onChange={(e) => setCustomPortInput(e.target.value)}
								onBlur={handleSavePort}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										void handleSavePort();
									}
								}}
								small
								style={{ width: '120px' }}
							/>
						}
					/>
				</div>

				<Row
					center="xs"
					middle="xs"
					style={{ marginTop: '40px', width: '100%' }}
				>
					<div>
						<Col xs={12}>
							<img
								src={`http://127.0.0.1:${clientViewerPort}/logo512.png`}
								alt="logo"
								style={{ width: '100px' }}
							/>
						</Col>
						<Col xs={12}>
							<H3>{t('about-deskreen')}</H3>
						</Col>
						<Col xs={12}>
							<Text>{`${t('version')}: ${currentVersion} (${currentVersion})`}</Text>
						</Col>
						<Col xs={12}>
							<Text>
								{`${t('copyright')} © ${new Date().getFullYear()} `}
								<a
									href="https://www.linkedin.com/in/pavlobu/"
									target="_blank"
									rel="noopener noreferrer"
									className="bp3-link"
								>
									Pavlo Buidenkov
								</a>
							</Text>
						</Col>
						<Col xs={12}>
							<Text>
								{`${t('website')}: `}
								<a
									href="https://www.deskreen.com"
									target="_blank"
									rel="noopener noreferrer"
									className="bp3-link"
								>
									https://www.deskreen.com
								</a>
							</Text>
						</Col>
					</div>
				</Row>
			</div>
		);
	};

	const getTabNavGeneralSettingsButton = (): React.ReactElement => {
		return (
			<Row middle="xs" className={classes.tabNavigationRowButton}>
				<Icon icon="wrench" className={classes.iconInTablLeftButton} />
				<Text className="bp3-text-large">{t('general')}</Text>
			</Row>
		);
	};

	return (
		<Overlay2
			onClose={handleClose}
			className={`${Classes.OVERLAY_SCROLL_CONTAINER} bp3-overlay-settings`}
			autoFocus
			canEscapeKeyClose
			canOutsideClickClose
			enforceFocus
			hasBackdrop
			isOpen={isSettingsOpen}
			usePortal
			transitionDuration={0}
		>
			<div className={classes.overlayInnerRoot}>
				<div
					id="settings-overlay-inner"
					className={`${classes.overlayInsideFade} ${Classes.CARD}`}
					style={{
						borderRadius: '8px',
					}}
				>
					<CloseOverlayButton
						className={classes.absoluteCloseButton}
						onClick={handleClose}
						isDefaultStyles
					/>
					<Tabs
						animate
						id="TabsExample"
						key="vertical"
						renderActiveTabPanelOnly
						vertical
					>
						<Tab
							id="rx"
							title=""
							panel={<GeneralSettingsPanel />}
							panelClassName={'tab-panel-wide-custom-style'}
						>
							{getTabNavGeneralSettingsButton()}
						</Tab>
						<TabsExpander />
					</Tabs>
				</div>
			</div>
		</Overlay2>
	);
}
