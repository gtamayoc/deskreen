import React from 'react';
import { Button, Icon } from '@blueprintjs/core';
import classes from './CloseOverlayButton.module.css';

class CloseOverlayButtonProps {
	onClick = () => {
		// noop default handler
	};

	style? = {};

	isDefaultStyles? = false;

	className? = '';
}

const CloseOverlayButton: React.FC<CloseOverlayButtonProps> = (
	props: CloseOverlayButtonProps,
) => {
	const { className, isDefaultStyles, style, onClick } = props;
	return (
		<Button
			id="close-overlay-button"
			className={isDefaultStyles ? `${classes.closeButton} ${className}` : ''}
			onClick={onClick}
			style={style}
		>
			<Icon icon="cross" size={30} />
		</Button>
	);
};

export default CloseOverlayButton;
