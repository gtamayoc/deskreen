import React from 'react';

// Decoupled connector component for React 19
export function withStyles(styles: Record<string, unknown>) {
	return <P extends object>(Component: React.ComponentType<P>) => {
		return function StyledComponent(props: P) {
			return <Component {...props} styles={styles} />;
		};
	};
}

export const StepConnector: React.FC<{ className?: string }> = ({ className }) => (
	<div className={className} />
);

const ColorlibConnector = withStyles({
	alternativeLabel: {
		top: 43,
	},
	active: {
		'& $line': {
			backgroundImage:
				'linear-gradient( 95deg, #3DCC91 0%, #15B371 50%, #FFB366 100%)',
		},
	},
	completed: {
		'& $line': {
			backgroundImage:
				'linear-gradient( 95deg, #3DCC91 0%, #15B371 50%, #3DCC91 100%)',
		},
	},
	line: {
		height: 2,
		border: 0,
		backgroundColor: 'var(--color-stepper-connector, #CED9E0)',
		borderRadius: 1,
	},
})(StepConnector);

export default ColorlibConnector;
