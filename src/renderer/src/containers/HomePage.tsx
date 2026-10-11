import React, { useCallback, useState } from 'react';
import { Classes } from '@blueprintjs/core';

import DeskreenStepper from './DeskreenStepper';
import { Device } from '../../../common/Device';
import TopPanel from '@renderer/components/TopPanel';
import ScreenRecordingPermissionModal from '@renderer/components/ScreenRecordingPermissionModal';
import { IpcEvents } from '../../../common/IpcEvents.enum';
import { useScreenRecordingPermission } from '@renderer/hooks/useScreenRecordingPermission';

export default function HomePage(): React.ReactElement {
	console.log('window.api', window.api);
	const [activeStep, setActiveStep] = useState(0);
	const [isAllowDeviceAlertOpen, setIsAllowDeviceAlertOpen] = useState(false);
	const [isUserAllowedConnection, setIsUserAllowedConnection] = useState(false);
	const [pendingConnectionDevice, setPendingConnectionDevice] =
		useState<Device | null>(null);

	const hasScreenPermission = useScreenRecordingPermission();

	const handleResetWithSharingSessionRestart =
		useCallback(async (): Promise<void> => {
			setActiveStep(0);
			setPendingConnectionDevice(null);
			setIsUserAllowedConnection(false);
			setIsAllowDeviceAlertOpen(false);

			await window.electron.ipcRenderer.invoke(
				IpcEvents.ResetWaitingForConnectionSharingSession,
			);
			await window.electron.ipcRenderer.invoke(
				IpcEvents.CreateWaitingForConnectionSharingSession,
			);
		}, []);

	return (
		<div className={Classes.TREE}>
			<TopPanel handleReset={handleResetWithSharingSessionRestart} />
			<DeskreenStepper
				activeStep={activeStep}
				setActiveStep={setActiveStep}
				isAllowDeviceAlertOpen={isAllowDeviceAlertOpen}
				setIsAllowDeviceAlertOpen={setIsAllowDeviceAlertOpen}
				isUserAllowedConnection={isUserAllowedConnection}
				setIsUserAllowedConnection={setIsUserAllowedConnection}
				pendingConnectionDevice={pendingConnectionDevice}
				setPendingConnectionDevice={setPendingConnectionDevice}
				handleReset={handleResetWithSharingSessionRestart}
			/>
			<ScreenRecordingPermissionModal isOpen={!hasScreenPermission} />
		</div>
	);
}
