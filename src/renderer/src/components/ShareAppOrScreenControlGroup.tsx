import { useState, useCallback, useEffect } from 'react';
import { Button, Icon, ControlGroup, Text } from '@blueprintjs/core';
import ChooseAppOrScreenOverlay from './StepsOfStepper/ChooseAppOrScreenOverlay/ChooseAppOrScreenOverlay';
import { useTranslation } from 'react-i18next';
import { IpcEvents } from '../../../common/IpcEvents.enum';
import { ensureVirtualDisplay } from '../features/VirtualDisplay/virtualDisplayRenderer';

interface ShareAppOrScreenControlGroupProps {
	handleNextEntireScreen: () => void;
	handleNextApplicationWindow: () => void;
}

const controlGroupRootStyle: React.CSSProperties = {
	width: '380px',
	display: 'flex',
	position: 'relative',
	left: '20px',
};

const shareEntireScreenButtonStyle: React.CSSProperties = {
	height: '180px',
	width: '50%',
	color: 'white',
	fontSize: '20px',
	borderRadius: '20px 0px 0px 20px',
	textAlign: 'center',
};

const orDecorationButtonStyle: React.CSSProperties = {
	height: '38px',
	width: '40px',
	borderRadius: '100px',
	position: 'relative',
	top: '70px',
	left: '-190px',
	cursor: 'default',
	zIndex: 999,
};

export default function ShareAppOrScreenControlGroup(
	props: ShareAppOrScreenControlGroupProps,
) {
	const { handleNextEntireScreen, handleNextApplicationWindow } = props;
	const { t } = useTranslation();
	const [isShareAppHovered, setIsShareAppHovered] = useState(false);

	const [isChooseAppOrScreenOverlayOpen, setChooseAppOrScreenOverlayOpen] =
		useState(false);

	const [isEntireScreenToShareChosen, setEntireScreenToShareChosen] =
		useState(false);

	const [isWaylandSession, setIsWaylandSession] = useState(false);

	useEffect(() => {
		let cancelled = false;

		window.electron.ipcRenderer
			.invoke(IpcEvents.GetIsLinuxWaylandSession)
			.then((value: boolean) => {
				if (!cancelled) {
					setIsWaylandSession(Boolean(value));
				}
			})
			.catch((error: unknown) => {
				console.error('failed to detect session environment', error);
			});

		// Auto-detect and trigger virtual display provisioner if needed
		ensureVirtualDisplay().catch((error: unknown) => {
			console.warn('[VirtualDisplay] Auto-provision check error:', error);
		});

		return () => {
			cancelled = true;
		};
	}, []);

	const handleOpenChooseAppOrScreenOverlay = useCallback(() => {
		setChooseAppOrScreenOverlayOpen(true);
	}, []);

	const handleCloseChooseAppOrScreenOverlay = useCallback(() => {
		setChooseAppOrScreenOverlayOpen(false);
	}, []);

	const handleWaylandShare = useCallback(
		async (mode: 'screen' | 'window') => {
			try {
				const sourceId: string | null =
					await window.electron.ipcRenderer.invoke(
						IpcEvents.RequestDesktopCapturerPortalSource,
						{ mode },
					);
				if (!sourceId) {
					return;
				}
				await window.electron.ipcRenderer.invoke(
					IpcEvents.SetDesktopCapturerSourceId,
					sourceId,
				);
				if (mode === 'screen') {
					handleNextEntireScreen();
				} else {
					handleNextApplicationWindow();
				}
			} catch (error) {
				console.error(
					'failed to acquire desktop capture source via portal',
					error,
				);
			}
		},
		[handleNextApplicationWindow, handleNextEntireScreen],
	);

	const handleChooseAppOverlayOpen = useCallback(() => {
		if (isWaylandSession) {
			void handleWaylandShare('window');
			return;
		}
		setEntireScreenToShareChosen(false);
		handleOpenChooseAppOrScreenOverlay();
	}, [
		handleOpenChooseAppOrScreenOverlay,
		handleWaylandShare,
		isWaylandSession,
	]);

	const handleChooseEntireScreenOverlayOpen = useCallback(() => {
		if (isWaylandSession) {
			void handleWaylandShare('screen');
			return;
		}
		setEntireScreenToShareChosen(true);
		handleOpenChooseAppOrScreenOverlay();
	}, [
		handleOpenChooseAppOrScreenOverlay,
		handleWaylandShare,
		isWaylandSession,
	]);

	return (
		<>
			<ControlGroup
				id="share-screen-or-app-btn-group"
				fill
				vertical={false}
				style={controlGroupRootStyle}
			>
				<Button
					style={shareEntireScreenButtonStyle}
					intent="primary"
					onClick={handleChooseEntireScreenOverlayOpen}
				>
					<Icon
						style={{ marginBottom: '20px' }}
						icon="desktop"
						size={100}
						color="white"
					/>
					<Text className="bp3-running-text">{t('entire-screen')}</Text>
				</Button>
				<Button
					style={{
						height: '180px',
						width: '50%',
						borderRadius: '0px 20px 20px 0px',
						color: 'white',
						fontSize: '20px',
						textAlign: 'center',
						backgroundColor: isShareAppHovered ? '#4097ce' : '#48AFF0',
					}}
					intent="primary"
					onClick={handleChooseAppOverlayOpen}
					onMouseEnter={() => setIsShareAppHovered(true)}
					onMouseLeave={() => setIsShareAppHovered(false)}
				>
					<Icon
						style={{ marginBottom: '20px' }}
						icon="application"
						size={100}
						color="white"
					/>
					<Text className="bp3-running-text">{t('application-window')}</Text>
				</Button>
				<Button
					active
					style={orDecorationButtonStyle}
				>
					{t('or')}
				</Button>
			</ControlGroup>
			<ChooseAppOrScreenOverlay
				isEntireScreenToShareChosen={isEntireScreenToShareChosen}
				isChooseAppOrScreenOverlayOpen={isChooseAppOrScreenOverlayOpen}
				handleClose={handleCloseChooseAppOrScreenOverlay}
				handleNextEntireScreen={handleNextEntireScreen}
				handleNextApplicationWindow={handleNextApplicationWindow}
				isWaylandSession={isWaylandSession}
			/>
		</>
	);
}
