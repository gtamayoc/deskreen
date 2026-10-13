import { Icon } from '@blueprintjs/core';
import { StepIconProps } from '@material-ui/core/StepIcon';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import React, { ReactNode } from 'react';

export interface StepIconPropsDeskreen extends StepIconProps {
	isEntireScreenSelected: boolean;
	isApplicationWindowSelected: boolean;
}

const useColorlibStepIconStyles = makeStyles({
	root: {
		backgroundColor: 'var(--color-stepper-step-bg, #BFCCD6)',
		zIndex: 1,
		color: 'var(--color-stepper-step-icon, #5C7080)',
		width: 65,
		height: 65,
		display: 'flex',
		borderRadius: '50%',
		justifyContent: 'center',
		alignItems: 'center',
	},
	active: {
		backgroundImage:
			'linear-gradient( 136deg, #FFB366 0%, #F29D49 50%, #A66321 100%)',
		boxShadow: '0 4px 10px 0 rgba(0,0,0,.25)',
		color: '#ffffff',
	},
	completed: {
		backgroundImage:
			'linear-gradient( 136deg, #3DCC91 0%, #15B371 50%, #0E5A8A 100%)',
		color: '#ffffff',
	},
	stepContent: {},
});

const getDesktopOrAppIcon = (isDesktop: boolean): ReactNode => {
	if (isDesktop) {
		return <Icon icon="desktop" size={25} />;
	}
	return <Icon icon="application" size={25} />;
};

export default function ColorlibStepIcon(
	props: StepIconPropsDeskreen,
): ReactNode {
	const { icon } = props;
	const classes = useColorlibStepIconStyles();
	const { active, completed, isEntireScreenSelected } = props;

	const icons: { [index: string]: React.ReactNode } = {
		1: completed ? (
			<Icon icon="feed-subscribed" size={25} />
		) : (
			<Icon icon="feed" size={25} />
		),
		2: completed ? (
			getDesktopOrAppIcon(isEntireScreenSelected)
		) : (
			<Icon icon="flow-branch" size={25} />
		),
		3: completed ? (
			<Icon icon="tick-circle" size={25} />
		) : (
			<Icon icon="confirm" size={25} />
		),
	};

	return (
		<div
			className={`${clsx(classes.root, {
				[classes.active]: active,
				[classes.completed]: completed,
			})}`}
		>
			{icons[String(icon)]}
		</div>
	);
}
