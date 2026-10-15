import React from 'react';
import { Row, Col } from 'react-flexbox-grid';
import { Icon, Text } from '@blueprintjs/core';

const oneSettingRowStyle: React.CSSProperties = {
	color: 'var(--text-color, #182026)',
	fontSize: '18px',
	fontWeight: 900,
	display: 'flex',
	flexDirection: 'row',
	alignItems: 'center',
};

const settingRowIconStyle: React.CSSProperties = {
	margin: '10px',
	color: 'var(--text-muted-color, #8A9BA8)',
};

interface SettingRowLabelAndInput {
	icon: string;
	label: string;
	input: React.ReactNode;
}

export default function SettingRowLabelAndInput(
	props: SettingRowLabelAndInput,
) {
	const { icon, label, input } = props;

	return (
		<Row middle="xs" between="xs" style={{ display: 'flex', width: '100%' }}>
			<div style={{ flex: 8 }}>
				<div style={oneSettingRowStyle}>
					<Col>
						<Icon
							// @ts-ignore: ok here
							icon={icon}
							size={25}
							style={settingRowIconStyle}
						/>
					</Col>
					<Col>
						<Text>{label}</Text>
					</Col>
				</div>
			</div>
			<div style={{ flex: 1 }}>
				<Row>{input}</Row>
			</div>
		</Row>
	);
}
