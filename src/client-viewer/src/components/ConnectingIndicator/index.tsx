import React from 'react';
import { Text } from '@blueprintjs/core';
import { Row } from 'react-flexbox-grid';
import ConnectingIndicatorIcon from './ConnectingIndicatorIcon';
import LoadingSharingIcon from './LoadingSharingIcon';

const basePulsingCircleStyles = {
	borderRadius: '100%',
	marginLeft: 'auto',
	marginRight: 'auto',
	left: '0',
	right: '0',
	textAlign: 'center',
	position: 'absolute',
	width: '100px',
	height: '100px',
};

function getConnectingStepContent(
	currentStep: number,
	connectionIconType: ConnectionIconType,
	loadingSharingIconType: LoadingSharingIconType,
	isShownLoadingSharingIcon: boolean,
) {
	const pulsingCircle1Styles = {
		...basePulsingCircleStyles,
		zIndex: 1,
		backgroundColor: 'rgba(43, 149, 214, 0.7)',
	} as React.CSSProperties;

	const pulsingCircle2Styles = {
		...basePulsingCircleStyles,
		zIndex: 2,
		backgroundColor: '#2B95D6',
	} as React.CSSProperties;

	const pulsingCircle3Styles = {
		...basePulsingCircleStyles,
		backgroundColor: '#15B371',
	} as React.CSSProperties;

	switch (currentStep) {
		case 1:
			return (
				<div
					style={{
						position: 'relative',
						width: '100px',
						height: '100px',
						margin: '8px auto',
					}}
				>
					<div id="pulsing-circle-1" style={pulsingCircle1Styles}></div>
					<div id="pulsing-circle-2" style={pulsingCircle2Styles}>
						<ConnectingIndicatorIcon connectionIconType={connectionIconType} />
					</div>
				</div>
			);
		case 2:
			return (
				<div
					style={{
						position: 'relative',
						width: '100px',
						height: '100px',
						margin: '8px auto',
					}}
				>
					<div
						id="pulsing-circle-3"
						className="pulse-3-once"
						style={pulsingCircle3Styles}
					>
						<ConnectingIndicatorIcon connectionIconType={connectionIconType} />
					</div>
				</div>
			);
		case 3:
			return (
				<div style={{ width: '100%', margin: '8px auto 0 auto' }}>
					<LoadingSharingIcon
						isShownLoadingSharingIcon={isShownLoadingSharingIcon}
						loadingSharingIconType={loadingSharingIconType}
					/>
				</div>
			);
		default:
			return <Text>Error occurred :(</Text>;
	}
}

interface ConnectingIndicatorProps {
	currentStep: number;
	connectionIconType: ConnectionIconType;
	isShownSelectingSharingIcon: boolean;
	selectingSharingIconType: LoadingSharingIconType;
}

function ConnectingIndicator(props: ConnectingIndicatorProps) {
	const {
		currentStep,
		connectionIconType,
		isShownSelectingSharingIcon,
		selectingSharingIconType,
	} = props;

	return (
		<Row
			id="connecting-screen"
			center="xs"
			middle="xs"
			style={{
				width: '100%',
				margin: '0 auto',
			}}
		>
			{getConnectingStepContent(
				currentStep,
				connectionIconType,
				selectingSharingIconType,
				isShownSelectingSharingIcon,
			)}
		</Row>
	);
}

export default ConnectingIndicator;
