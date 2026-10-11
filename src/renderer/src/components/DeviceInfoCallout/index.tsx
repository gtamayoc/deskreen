import React from 'react';
import { Callout, Text, H4, Tooltip, Position, Tag } from '@blueprintjs/core';
import { Row, Col } from 'react-flexbox-grid';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

function getContentOfTooltip(t: TFunction) {
	return (
		<>
			<Text>
				{t(
					'this-should-match-with-device-ip-displayed-on-the-screen-of-device-that-is-trying-to-connect',
				)}
			</Text>
			<span style={{ fontWeight: 900 }}>
				<Text>{t('if-ip-addresses-dont-match-click-disconnect-button')}</Text>
			</span>
		</>
	);
}

interface DeviceInfoCalloutProps {
	deviceType: string | undefined;
	deviceIP: string | undefined;
	deviceOS: string | undefined;
	deviceBrowser: string | undefined;
	deviceRoomId: string | undefined;
	transportType?: 'wifi' | 'usb';
	isReconnecting?: boolean;
}

const DeviceInfoCallout: React.FC<DeviceInfoCalloutProps> = (props) => {
	const { t } = useTranslation();
	const {
		deviceType,
		deviceIP,
		deviceOS,
		deviceRoomId,
		deviceBrowser,
		transportType,
		isReconnecting,
	} = props;
	const isUsb =
		transportType === 'usb' ||
		deviceIP?.includes('127.0.0.1') ||
		deviceIP?.includes('localhost');

	return (
		<>
			<H4 style={{ margin: '0 auto', textAlign: 'center' }}>
				{t('partner-device-info')}
			</H4>
			<Callout id="device-info-callout" style={{ borderRadius: '8px' }}>
				<Row center="xs">
					<Col xs={12}>
						<Text>
							{t('device-type')}: <span>{deviceType}</span>
						</Text>
						<Tooltip content={getContentOfTooltip(t)} position={Position.TOP}>
							<div
								className="device-ip-badge-wrapper"
								style={{
									fontWeight: 900,
									backgroundColor: '#00f99273',
									paddingLeft: '10px',
									paddingRight: '10px',
									borderRadius: '20px',
								}}
							>
								<Text className="bp3-text-large">
									{t('device-ip')}:{' '}
									<span className="device-ip-span">{deviceIP}</span>
								</Text>
							</div>
						</Tooltip>
						<Text>
							{t('device-browser')}: <span>{deviceBrowser}</span>
						</Text>
						<Text>
							{t('device-os')}: <span>{deviceOS}</span>
						</Text>
						<Text>
							{t('device-connection-id')}: <span>{deviceRoomId}</span>
						</Text>
						<div style={{ marginTop: '8px' }}>
							{isReconnecting && (
								<Tag intent="warning" round style={{ marginRight: '6px' }}>
									Reconectando...
								</Tag>
							)}
							{isUsb ? (
								<Tag intent="success" icon="flash" round>
									USB (Reverse ADB)
								</Tag>
							) : (
								<Tag intent="primary" icon="feed" round>
									Wi-Fi
								</Tag>
							)}
						</div>
					</Col>
				</Row>
			</Callout>
		</>
	);
};

export default DeviceInfoCallout;
