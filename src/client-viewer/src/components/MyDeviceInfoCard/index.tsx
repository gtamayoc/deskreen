import { Callout, Card, H4, Text, Tooltip, Position } from '@blueprintjs/core';
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
				marginBottom: '10px',
				padding: '12px 14px',
				width: '100%',
				boxSizing: 'border-box',
			}}
		>
			<H4 style={{ margin: '0 0 6px 0', fontSize: '15px' }}>{`${t('My Device Info')}:`}</H4>
			<Callout style={{ padding: '8px 10px', marginBottom: '6px' }}>
				<Text style={{ fontSize: '13px' }}>{`${t('Device Type')}: ${myDeviceType}`}</Text>
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
							paddingLeft: '10px',
							paddingRight: '10px',
							borderRadius: '20px',
							marginTop: '2px',
							marginBottom: '2px',
						}}
					>
						<Text style={{ fontSize: '13px' }}>{`${t('Device IP')}: ${myIP}`}</Text>
					</div>
				</Tooltip>
				<Text style={{ fontSize: '13px' }}>{`${t('Device Browser')}: ${myBrowser}`}</Text>
				<Text style={{ fontSize: '13px' }}>{`${t('Device OS')}: ${myOS}`}</Text>
				<Text style={{ fontSize: '13px' }}>{`${t('My Current Connection ID')}: ${myRoomId}`}</Text>
			</Callout>
			<Text className="bp3-text-muted" style={{ fontSize: '11px', lineHeight: '1.2' }}>
				{t(
					'These details should match with the ones that you see in alert popup on computer screen, where Deskreen-CE is running',
				)}
			</Text>
		</Card>
	);
}

export default MyDeviceInfoCard;
