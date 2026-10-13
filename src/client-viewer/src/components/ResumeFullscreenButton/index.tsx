import { Button, Icon } from '@blueprintjs/core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import './index.css';

interface ResumeFullscreenButtonProps {
	onResume: () => void;
	onDismiss: () => void;
}

export const ResumeFullscreenButton: React.FC<ResumeFullscreenButtonProps> = ({
	onResume,
	onDismiss,
}) => {
	const { t } = useTranslation();
	const label = t('Resume Fullscreen', 'Reanudar Pantalla Completa');

	return (
		<div className="resume-fullscreen-overlay" role="region" aria-label={label}>
			<Button
				className="resume-fullscreen-action-btn bp3-intent-primary"
				icon={<Icon icon="fullscreen" size={18} color="#ffffff" />}
				text={<span className="resume-fullscreen-text">{label}</span>}
				onClick={onResume}
				aria-label={label}
			/>
			<Button
				className="resume-fullscreen-dismiss-btn bp3-minimal"
				icon={<Icon icon="cross" size={16} color="#e1e8ed" />}
				onClick={onDismiss}
				aria-label={t('Dismiss', 'Cerrar')}
			/>
		</div>
	);
};

export default ResumeFullscreenButton;
