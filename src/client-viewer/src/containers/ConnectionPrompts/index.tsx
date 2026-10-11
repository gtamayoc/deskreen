import { Button, H4, Icon } from '@blueprintjs/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import ConnectingIndicator from '../../components/ConnectingIndicator';
import MyDeviceInfoCard from '../../components/MyDeviceInfoCard';
import { useTheme } from '../../providers/ThemeProvider';

interface ConnectionPropmptsProps {
	myDeviceDetails: DeviceDetails;
	isShownTextPrompt: boolean;
	promptStep: number;
	connectionIconType: ConnectionIconType;
	isShownSpinnerIcon: boolean;
	spinnerIconType: LoadingSharingIconType;
}

function getPromptContent(t: TFunction, step: number) {
	switch (step) {
		case 1:
			return (
				<H4
					style={{
						margin: '4px 0 8px 0',
						fontSize: '15px',
						lineHeight: '1.3',
					}}
				>
					{
						t(
							'Waiting for user to click ALLOW button on screen sharing device...',
						) as string
					}
				</H4>
			);
		case 2:
			return (
				<H4 style={{ margin: '4px 0 8px 0', fontSize: '15px' }}>
					{t('Connected!') as string}
				</H4>
			);
		case 3:
			return (
				<H4
					style={{
						margin: '4px 0 8px 0',
						fontSize: '15px',
						lineHeight: '1.3',
					}}
				>
					{
						t(
							'Waiting for user to select source to share from screen sharing device...',
						) as string
					}
				</H4>
			);
		default:
			return (
				<H4 style={{ margin: '4px 0 8px 0', fontSize: '15px' }}>
					{`${t('Error occurred')} :(`}
				</H4>
			);
	}
}

function ConnectionPropmpts(props: ConnectionPropmptsProps) {
	const {
		myDeviceDetails,
		promptStep,
		connectionIconType,
		isShownSpinnerIcon,
		spinnerIconType,
	} = props;

	const { t } = useTranslation();
	const { isDarkMode, toggleDarkMode } = useTheme();

	const handleReinitiateConnection = () => {
		window.location.reload();
	};

	return (
		<div
			className="connection-prompts-container"
			style={{
				position: 'absolute',
				zIndex: 10,
				top: 0,
				left: 0,
				width: '100%',
				minHeight: '100%',
				maxHeight: '100dvh',
				overflowY: 'auto',
				backgroundColor: 'var(--light-bg-color, #f4f8fa)',
				color: 'var(--text-color, #182026)',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				padding: '12px 14px',
				boxSizing: 'border-box',
			}}
		>
			<div
				className="connection-prompts-theme-toggle"
				style={{
					position: 'absolute',
					top: 'max(12px, env(safe-area-inset-top, 12px))',
					right: 'max(14px, env(safe-area-inset-right, 14px))',
					zIndex: 20,
				}}
			>
				<Button
					minimal
					className="rounded-pill-button theme-toggle-btn"
					icon={<Icon icon={isDarkMode ? 'flash' : 'moon'} />}
					onClick={toggleDarkMode}
					title={
						isDarkMode
							? (t('Modo Claro') as string)
							: (t('Modo Oscuro') as string)
					}
					aria-label={
						isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
					}
					style={{
						padding: '8px',
						fontSize: '16px',
						minHeight: '40px',
						minWidth: '40px',
						display: 'inline-flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				/>
			</div>
			<div
				style={{
					width: '100%',
					maxWidth: '460px',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					textAlign: 'center',
					marginTop: '8px',
				}}
			>
				<MyDeviceInfoCard deviceDetails={myDeviceDetails} />
				<div
					id="prompt-text"
					style={{ fontSize: '15px', margin: '4px 0', width: '100%' }}
				>
					{getPromptContent(t, promptStep)}
				</div>
				<Button
					className="rounded-pill-button"
					intent="warning"
					onClick={handleReinitiateConnection}
					style={{ marginTop: '8px', marginBottom: '14px' }}
				>
					{t('re-initiate-connection') as string}
				</Button>
			</div>
			<div
				style={{
					width: '100%',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					flex: 1,
					minHeight: '110px',
					position: 'relative',
				}}
			>
				<ConnectingIndicator
					currentStep={promptStep}
					connectionIconType={connectionIconType}
					isShownSelectingSharingIcon={isShownSpinnerIcon}
					selectingSharingIconType={spinnerIconType}
				/>
			</div>
		</div>
	);
}

export default ConnectionPropmpts;
