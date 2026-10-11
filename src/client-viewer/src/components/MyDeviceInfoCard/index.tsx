import { Callout, Card, H3, Text, Tooltip, Position } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';

interface MyDeviceDetailsCardProps {
	deviceDetails: DeviceDetails;
}

function MyDeviceInfoCard(props: MyDeviceDetailsCardProps) {
	const { t } = useTranslation();

	const { deviceDetails } = props;
	const { myIP, myOS, myDeviceType, myBrowser, myRoomId } = deviceDetails;

	return (
		<Card
			elevation={3}
			style={{
				backgroundColor: 'var(--card-bg-color, #ffffff)',
				marginBottom: '30px',
			}}
		>
			<H3>{`${t('My Device Info')}:`}</H3>
			<Callout>
				<Text>{`${t('Device Type')}: ${myDeviceType}`}</Text>
				<Tooltip
					content={t(
						'Your Device IP should match with Device IP in alert popup appeared on your computer, where Deskreen-CE is running',
					)}
					position={Position.TOP}
				>
					<div
						className="device-ip-badge-wrapper"
						style={{
							display: 'inline-block',
							fontWeight: 900,
							paddingLeft: '12px',
							paddingRight: '12px',
							borderRadius: '20px',
							marginTop: '4px',
							marginBottom: '4px',
						}}
					>
						<Text>{`${t('Device IP')}: ${myIP}`}</Text>
					</div>
				</Tooltip>
				<Text>{`${t('Device Browser')}: ${myBrowser}`}</Text>
				<Text>{`${t('Device OS')}: ${myOS}`}</Text>
				<Text>{`${t('My Current Connection ID')}: ${myRoomId}`}</Text>
			</Callout>
			<Text className="bp3-text-muted">
				{t(
					'These details should match with the ones that you see in alert popup on computer screen, where Deskreen-CE is running',
				)}
			</Text>
		</Card>
	);
}

export default MyDeviceInfoCard;
