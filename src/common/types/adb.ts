export type AdbAvailabilitySource = 'system' | 'internal' | 'none';

export interface AdbAvailabilityStatus {
	available: boolean;
	source: AdbAvailabilitySource;
	path?: string;
	version?: string;
}

export interface AdbDeviceInfo {
	id: string;
	type: string;
	model?: string;
	product?: string;
	inGracePeriod?: boolean;
	gracePeriodExpired?: boolean;
}

export interface DeviceSessionIdentity {
	deviceId: string;
	adbSerial?: string;
	userAgent?: string;
	deviceModel?: string;
	deviceIP?: string;
	sessionAuthToken: string;
	transportType: 'wifi' | 'usb';
	authorizedAt: number;
	lastSeenAt: number;
}
