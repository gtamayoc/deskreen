import {
	Button,
	Classes,
	Dialog,
	H1,
	H3,
	H4,
	H5,
	Icon,
	Spinner,
} from '@blueprintjs/core';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import AllowConnectionForDeviceAlert from '@renderer/components/AllowConnectionForDeviceAlert';
import LanguageSelector from '@renderer/components/LanguageSelector';
import IntermediateStep from '@renderer/components/StepsOfStepper/IntermediateStep';
import { getShuffledArrayOfHello } from '@renderer/configs/i18next.config.client';
import { showMessageFromNewToaster } from '@renderer/utils/showMessageFromNewToaster';
import { TFunction } from 'i18next';
import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { Col, Grid, Row } from 'react-flexbox-grid';
import { useTranslation } from 'react-i18next';
import { Device } from '../../../common/Device';
import { IpcEvents } from '../../../common/IpcEvents.enum';
import SuccessStep from '../components/StepsOfStepper/SuccessStep';

const useStyles = makeStyles(() =>
	createStyles({
		stepContent: {
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'center',
			alignItems: 'center',
		},
	}),
);

function getSteps(t: TFunction): string[] {
	return [t('connect'), t('select'), t('confirm')];
}

const getDeviceFingerprint = (device: Device | null): string => {
	if (!device) return '';
	return `${device.deviceIP || ''}_${device.deviceOS || ''}_${device.deviceBrowser || ''}`;
};

interface Props {
	activeStep: number;
	setActiveStep: React.Dispatch<React.SetStateAction<number>>;
	isAllowDeviceAlertOpen: boolean;
	setIsAllowDeviceAlertOpen: (isOpen: boolean) => void;
	isUserAllowedConnection: boolean;
	setIsUserAllowedConnection: (isAllowed: boolean) => void;
	pendingConnectionDevice: Device | null;
	setPendingConnectionDevice: (device: Device | null) => void;
	handleReset: () => void;
}

const DeskreenStepper = ({
	activeStep,
	setActiveStep,
	isAllowDeviceAlertOpen,
	setIsAllowDeviceAlertOpen,
	isUserAllowedConnection,
	setIsUserAllowedConnection,
	pendingConnectionDevice,
	setPendingConnectionDevice,
	handleReset,
}: Props): ReactNode => {
	const classes = useStyles();
	const { t } = useTranslation();

	const [, setIsEntireScreenSelected] = useState(false);
	const [, setIsApplicationWindowSelected] = useState(false);
	const [isNoWiFiError, setisNoWiFiError] = useState(false);
	const [isSelectLanguageDialogOpen, setIsSelectLanguageDialogOpen] =
		useState(false);
	const [helloWord, setHelloWord] = useState('Hello');

	useEffect(() => {
		let helloInterval: NodeJS.Timeout;
		async function stepperOpenedCallback(): Promise<void> {
			const isFirstTimeStart = await window.electron.ipcRenderer.invoke(
				IpcEvents.GetIsFirstTimeAppStart,
			);
			setIsSelectLanguageDialogOpen(isFirstTimeStart);
			if (!isFirstTimeStart) return;
			const helloWords = getShuffledArrayOfHello();
			let pos = 0;
			helloInterval = setInterval(() => {
				if (pos + 1 === helloWords.length) {
					pos = 0;
				} else {
					pos += 1;
				}
				setHelloWord(helloWords[pos]);
			}, 4000);
		}
		stepperOpenedCallback();

		return () => {
			clearInterval(helloInterval);
		};
	}, []);

	useEffect(() => {
		const wifiCheckInterval = setInterval(async () => {
			if (
				activeStep > 0 ||
				pendingConnectionDevice ||
				isUserAllowedConnection
			) {
				setisNoWiFiError(false);
				return;
			}
			const isConnected = await window.electron.ipcRenderer.invoke(
				'check-wifi-connection',
			);
			if (
				!isConnected &&
				activeStep === 0 &&
				!pendingConnectionDevice &&
				!isUserAllowedConnection
			) {
				setisNoWiFiError(true);
			} else {
				setisNoWiFiError(false);
			}
		}, 1000);

		return () => {
			clearInterval(wifiCheckInterval);
		};
	}, [activeStep, pendingConnectionDevice, isUserAllowedConnection]);

	const steps = getSteps(t);

	const handleNext = useCallback((): void => {
		if (activeStep === steps.length - 1) {
			setIsEntireScreenSelected(false);
			setIsApplicationWindowSelected(false);
		}
		setActiveStep((prevActiveStep: number): number => prevActiveStep + 1);
	}, [activeStep, setActiveStep, steps]);

	const handleNextEntireScreen = useCallback((): void => {
		setActiveStep((prevActiveStep: number): number => prevActiveStep + 1);
		setIsEntireScreenSelected(true);
	}, [setActiveStep]);

	const handleNextApplicationWindow = useCallback((): void => {
		setActiveStep((prevActiveStep: number): number => prevActiveStep + 1);
		setIsApplicationWindowSelected(true);
	}, [setActiveStep]);

	const handleBack = useCallback((): void => {
		setActiveStep((prevActiveStep: number) => prevActiveStep - 1);
	}, [setActiveStep]);

	const handleCancelAlert = async (): Promise<void> => {
		setIsAllowDeviceAlertOpen(false);
		setActiveStep(0);
		setPendingConnectionDevice(null);
		setIsUserAllowedConnection(false);

		await window.electron.ipcRenderer.invoke(
			IpcEvents.ResetWaitingForConnectionSharingSession,
		);
		await window.electron.ipcRenderer.invoke(
			IpcEvents.CreateWaitingForConnectionSharingSession,
		);
	};

	const handleConfirmAlert = useCallback(
		async (trustThisDevice?: boolean) => {
			setIsAllowDeviceAlertOpen(false);
			setIsUserAllowedConnection(true);

			if (trustThisDevice && pendingConnectionDevice) {
				const fingerprint = getDeviceFingerprint(pendingConnectionDevice);
				if (fingerprint) {
					await window.electron.ipcRenderer.invoke(
						IpcEvents.AddTrustedDevice,
						fingerprint,
					);
				}
			}

			setActiveStep(1);
			await window.electron.ipcRenderer.invoke(
				IpcEvents.SetDeviceConnectedStatus,
			);
		},
		[
			pendingConnectionDevice,
			setActiveStep,
			setIsAllowDeviceAlertOpen,
			setIsUserAllowedConnection,
		],
	);

	useEffect(() => {
		window.electron.ipcRenderer.invoke(
			IpcEvents.CreateWaitingForConnectionSharingSession,
		);

		const handlePendingConnectionDevice = async (
			_: unknown,
			device: Device,
		): Promise<void> => {
			setPendingConnectionDevice(device);
			setIsUserAllowedConnection(true);
			setIsAllowDeviceAlertOpen(false);
			setisNoWiFiError(false);
			setIsEntireScreenSelected(true);
			setIsApplicationWindowSelected(false);
			setActiveStep(3);

			const fingerprint = `${device.deviceIP || ''}_${device.deviceOS || ''}_${device.deviceBrowser || ''}`;
			if (fingerprint) {
				try {
					await window.electron.ipcRenderer.invoke(
						IpcEvents.AddTrustedDevice,
						fingerprint,
					);
				} catch (e) {
					console.error('Failed to auto-trust device', e);
				}
			}

			try {
				await window.electron.ipcRenderer.invoke(
					IpcEvents.SetDeviceConnectedStatus,
				);
			} catch (e) {
				console.error('Failed to set device connected status', e);
			}

			try {
				let currentSourceId = (await window.electron.ipcRenderer.invoke(
					IpcEvents.GetWaitingForConnectionSharingSessionSourceId,
				)) as string;
				if (!currentSourceId) {
					const screenSourceIds = (await window.electron.ipcRenderer.invoke(
						IpcEvents.GetDesktopSharingSourceIds,
						{ isEntireScreenToShareChosen: true },
					)) as string[];
					if (screenSourceIds && screenSourceIds.length > 0) {
						currentSourceId = screenSourceIds[0];
						await window.electron.ipcRenderer.invoke(
							IpcEvents.SetDesktopCapturerSourceId,
							currentSourceId,
						);
					}
				}
			} catch (e) {
				console.warn('Failed to ensure default screen source id:', e);
			}

			try {
				await window.electron.ipcRenderer.invoke(
					IpcEvents.StartSharingOnWaitingForConnectionSharingSession,
				);
			} catch (e) {
				console.error('Failed to auto-start sharing session', e);
			}

			void showMessageFromNewToaster(
				`${t('connected')}: ${device.deviceBrowser || device.deviceOS || 'Device'}`,
			);
		};

		window.electron.ipcRenderer.on(
			IpcEvents.SetPendingConnectionDevice,
			handlePendingConnectionDevice,
		);

		return () => {
			window.electron.ipcRenderer.removeListener(
				IpcEvents.SetPendingConnectionDevice,
				handlePendingConnectionDevice,
			);
		};
	}, [
		setActiveStep,
		setIsAllowDeviceAlertOpen,
		setIsUserAllowedConnection,
		setPendingConnectionDevice,
		t,
	]);

	const renderIntermediateOrSuccessStepContent = useCallback(() => {
		if (activeStep >= steps.length) {
			return <SuccessStep handleReset={handleReset} />;
		}
		return (
			<div id="intermediate-step-container" style={{ width: '100%' }}>
				<IntermediateStep
					activeStep={activeStep}
					steps={steps}
					handleNext={handleNext}
					handleBack={handleBack}
					handleNextEntireScreen={handleNextEntireScreen}
					handleNextApplicationWindow={handleNextApplicationWindow}
					resetPendingConnectionDevice={() => setPendingConnectionDevice(null)}
					resetUserAllowedConnection={() => setIsUserAllowedConnection(false)}
					connectedDevice={pendingConnectionDevice}
					handleReset={handleReset}
				/>
			</div>
		);
	}, [
		activeStep,
		steps,
		handleReset,
		handleNext,
		handleBack,
		handleNextEntireScreen,
		handleNextApplicationWindow,
		pendingConnectionDevice,
		setIsUserAllowedConnection,
		setPendingConnectionDevice,
	]);

	return (
		<>
			<Row style={{ width: '100%' }}>
				<Col className={classes.stepContent} xs={12}>
					{renderIntermediateOrSuccessStepContent()}
				</Col>
			</Row>
			<AllowConnectionForDeviceAlert
				device={pendingConnectionDevice}
				isOpen={isAllowDeviceAlertOpen}
				onCancel={handleCancelAlert}
				onConfirm={handleConfirmAlert}
			/>
			<Dialog
				isOpen={
					isNoWiFiError &&
					activeStep === 0 &&
					!pendingConnectionDevice &&
					!isUserAllowedConnection
				}
				canEscapeKeyClose
				canOutsideClickClose
				onClose={() => setisNoWiFiError(false)}
				autoFocus
				usePortal
			>
				<Grid>
					<div style={{ padding: '10px' }}>
						<Row center="xs" style={{ marginTop: '10px' }}>
							<Icon icon="offline" size={50} className={Classes.TEXT_MUTED} />
						</Row>
						<Row center="xs" style={{ marginTop: '10px' }}>
							<H3>{t('no-wifi-and-lan-connection')}</H3>
						</Row>
						<Row center="xs">
							<H5>{t('deskreen-ce-works-only-with-wifi-and-lan-networks')}</H5>
						</Row>
						<Row center="xs">
							<Spinner size={50} />
						</Row>
						<Row center="xs" style={{ marginTop: '10px' }}>
							<H4>{t('waiting-for-connection')}</H4>
						</Row>
					</div>
				</Grid>
			</Dialog>
			<Dialog isOpen={isSelectLanguageDialogOpen} autoFocus usePortal>
				<Grid>
					<div style={{ padding: '10px' }}>
						<Row center="xs" style={{ marginTop: '10px' }}>
							<H1>{helloWord}</H1>
						</Row>
						<Row>
							<Col xs>
								<Row center="xs" style={{ marginTop: '20px' }}>
									<Icon
										icon="translate"
										size={50}
										className={Classes.TEXT_MUTED}
									/>
								</Row>
								<Row center="xs" style={{ marginTop: '20px' }}>
									<H5>{t('language')}</H5>
								</Row>
								<Row center="xs" style={{ marginTop: '10px' }}>
									<LanguageSelector />
								</Row>
							</Col>
						</Row>
						<Row center="xs" style={{ marginTop: '20px' }}>
							<Button
								minimal
								rightIcon="chevron-right"
								onClick={() => {
									setIsSelectLanguageDialogOpen(false);
									window.electron.ipcRenderer.invoke(
										IpcEvents.SetAppStartedOnce,
									);
								}}
								style={{ borderRadius: '50px' }}
							>
								{t('continue')}
							</Button>
						</Row>
					</div>
				</Grid>
			</Dialog>
		</>
	);
};

export default DeskreenStepper;
