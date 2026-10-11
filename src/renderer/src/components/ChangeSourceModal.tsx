import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, Button, ButtonGroup, Spinner, H3, Text } from '@blueprintjs/core';
import { Row, Col } from 'react-flexbox-grid';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import { useTranslation } from 'react-i18next';
import { IpcEvents } from '../../../common/IpcEvents.enum';
import SharingSourcePreviewCard from './SharingSourcePreviewCard';
import CloseOverlayButton from './CloseOverlayButton';
import { showMessageFromNewToaster } from '../utils/showMessageFromNewToaster';

interface ChangeSourceModalProps {
	isOpen: boolean;
	sharingSessionId: string;
	deviceName: string;
	onClose: () => void;
}

const useStyles = makeStyles(() =>
	createStyles({
		dialogRoot: {
			width: '90%',
			maxWidth: '900px',
			height: '85vh !important',
			overflowY: 'scroll',
			borderRadius: '12px',
		},
		header: {
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
			padding: '16px 20px',
			borderBottom: '1px solid rgba(128, 128, 128, 0.2)',
		},
		content: {
			padding: '20px',
			minHeight: '300px',
		},
		modeButtons: {
			marginBottom: '20px',
			display: 'flex',
			justifyContent: 'center',
		},
	}),
);

export const ChangeSourceModal: React.FC<ChangeSourceModalProps> = ({
	isOpen,
	sharingSessionId,
	deviceName,
	onClose,
}) => {
	const classes = useStyles();
	const { t } = useTranslation();
	const [isEntireScreen, setIsEntireScreen] = useState(true);
	const [sourceIds, setSourceIds] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const fetchSources = useCallback(async (entireScreen: boolean) => {
		setIsLoading(true);
		try {
			const ids: string[] = await window.electron.ipcRenderer.invoke(
				IpcEvents.GetDesktopSharingSourceIds,
				{ isEntireScreenToShareChosen: entireScreen },
			);
			setSourceIds(Array.isArray(ids) ? ids : []);
		} catch (error) {
			console.error('Failed to get sharing sources', error);
			setSourceIds([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			void fetchSources(isEntireScreen);
		} else {
			setSourceIds([]);
		}
	}, [isOpen, isEntireScreen, fetchSources]);

	const handleSelectSource = useCallback(
		async (sourceId: string) => {
			try {
				const success = await window.electron.ipcRenderer.invoke(
					IpcEvents.ChangeDesktopCapturerSourceForSession,
					{ sharingSessionId, sourceId },
				);
				if (success) {
					void showMessageFromNewToaster(
						`${t('share-screen')} - ${deviceName || 'Device'}`,
					);
				}
			} catch (err) {
				console.error('Failed to switch source:', err);
			} finally {
				onClose();
			}
		},
		[sharingSessionId, deviceName, t, onClose],
	);

	return (
		<Dialog
			isOpen={isOpen}
			onClose={onClose}
			className={classes.dialogRoot}
			usePortal
			autoFocus
			canEscapeKeyClose
			canOutsideClickClose
		>
			<div className={classes.header}>
				<div>
					<H3 style={{ margin: 0 }}>{t('choose-entire-screen-or-app-window-you-want-to-share')}</H3>
					<Text className="bp3-text-muted">
						{deviceName ? `Para: ${deviceName}` : ''}
					</Text>
				</div>
				<CloseOverlayButton onClick={onClose} isDefaultStyles />
			</div>

			<div className={classes.content}>
				<div className={classes.modeButtons}>
					<ButtonGroup>
						<Button
							intent={isEntireScreen ? 'primary' : 'none'}
							icon="desktop"
							onClick={() => setIsEntireScreen(true)}
							style={{ borderRadius: '20px 0 0 20px', padding: '8px 20px' }}
						>
							{t('entire-screen')}
						</Button>
						<Button
							intent={!isEntireScreen ? 'primary' : 'none'}
							icon="application"
							onClick={() => setIsEntireScreen(false)}
							style={{ borderRadius: '0 20px 20px 0', padding: '8px 20px' }}
						>
							{t('application-window')}
						</Button>
					</ButtonGroup>
				</div>

				{isLoading ? (
					<Row center="xs" middle="xs" style={{ minHeight: '200px' }}>
						<Spinner size={50} />
					</Row>
				) : (
					<Row around="xs">
						{sourceIds.map((id) => (
							<Col xs={12} md={6} key={id} style={{ marginBottom: '16px' }}>
								<SharingSourcePreviewCard
									sharingSourceID={id}
									isChangeAppearanceOnHover
									onClickCard={() => handleSelectSource(id)}
								/>
							</Col>
						))}
					</Row>
				)}
			</div>
		</Dialog>
	);
};

export default ChangeSourceModal;
