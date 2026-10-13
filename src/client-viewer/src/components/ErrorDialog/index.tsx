import { useCallback } from 'react';
import { Button, Classes, Dialog, Divider, Icon } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import './index.css';
import { type ErrorMessageType } from './ErrorMessageEnum';
import { useTheme } from '../../providers/ThemeProvider';

interface ErrorDialogProps {
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
	errorMessage: ErrorMessageType;
}

function ErrorDialog(props: ErrorDialogProps) {
	const { t } = useTranslation();
	const { errorMessage, isOpen, setIsOpen } = props;
	const { isDarkMode, toggleDarkMode } = useTheme();

	const handleReload = useCallback(() => {
		window.location.reload();
	}, []);

	const handleClose = useCallback(() => {
		setIsOpen(false);
	}, [setIsOpen]);

	const darkClass = isDarkMode ? `${Classes.DARK} bp3-dark` : '';

	return (
		<Dialog
			className={`error-dialog ${darkClass}`.trim()}
			portalClassName={darkClass}
			autoFocus
			canEscapeKeyClose
			canOutsideClickClose={false}
			enforceFocus
			isOpen={isOpen}
			backdropClassName="error-dialog-backdrop"
			onClose={handleClose}
		>
			<div className="error-dialog-container">
				{/* Top bar with Badge and Theme Toggle Button */}
				<div className="error-dialog-topbar">
					<div className="error-dialog-badge">
						<Icon icon="error" size={16} className="error-dialog-badge-icon" />
						<span className="error-dialog-badge-text">
							{t('Error occurred')}
						</span>
					</div>
					<Button
						minimal
						className="error-dialog-theme-toggle"
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
					/>
				</div>

				{/* Hero Section */}
				<div className="error-dialog-hero">
					<div className="error-dialog-hero-icon-wrapper">
						<Icon icon="error" size={32} className="error-dialog-hero-icon" />
					</div>
					<div className="error-dialog-hero-text">
						<h1 className="error-dialog-title">
							{`${t('Something went wrong')} :(`}
						</h1>
					</div>
				</div>

				<Divider className="error-dialog-divider" />

				{/* Localized Error Reason Card & Advice */}
				<div className={`error-dialog-body ${Classes.DIALOG_BODY}`}>
					<div className="error-dialog-message-card">
						<Icon
							icon="issue"
							size={18}
							className="error-dialog-message-icon"
						/>
						<div className="error-dialog-message-content">
							<div className="error-dialog-message-text">
								{t(`${errorMessage}`)}
							</div>
						</div>
					</div>

					<p className="error-dialog-advice">
						{`${t('You may close this browser window then try to connect again')}.`}
					</p>
				</div>

				<Divider className="error-dialog-divider" />

				{/* Action Buttons */}
				<div className="error-dialog-actions">
					<Button
						className="rounded-pill-button error-dialog-retry-btn"
						intent="warning"
						icon="refresh"
						onClick={handleReload}
					>
						{t('re-initiate-connection') as string}
					</Button>
					<Button
						minimal
						className="rounded-pill-button error-dialog-dismiss-btn"
						onClick={handleClose}
					>
						{t('Dismiss') as string}
					</Button>
				</div>
			</div>
		</Dialog>
	);
}

export default ErrorDialog;
