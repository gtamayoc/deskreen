import { Device } from '../../common/Device';

export const nullDevice: Device = {
	id: '',
	sharingSessionID: '',
	deviceOS: '',
	deviceType: '',
	deviceIP: '',
	deviceBrowser: '',
	deviceScreenWidth: -1,
	deviceScreenHeight: -1,
	deviceRoomId: '',
};

export const MAX_CONNECTED_DEVICES = 5;
const SLOT_VIOLATION_MESSAGE = `maximum viewer slots (${MAX_CONNECTED_DEVICES}) are already occupied`;

type ViewerConnectionAvailability = 'available' | 'occupied';

class MultiViewerSlot {
	private devices = new Map<string, Readonly<Device>>();
	private readonly maxDevices: number;

	constructor(maxDevices = MAX_CONNECTED_DEVICES) {
		this.maxDevices = maxDevices;
	}

	occupy(device: Device): void {
		if (this.devices.size >= this.maxDevices && !this.devices.has(device.id)) {
			throw new Error(SLOT_VIOLATION_MESSAGE);
		}
		this.devices.set(device.id, Object.freeze({ ...device }));
	}

	releaseById(deviceIDToRemove: string): boolean {
		return this.devices.delete(deviceIDToRemove);
	}

	release(): void {
		this.devices.clear();
	}

	isAvailable(): boolean {
		return true; // no arbitrary device limit
	}

	snapshot(): Device[] {
		return Array.from(this.devices.values()).map((d) => ({ ...d }));
	}

	isOccupiedBy(deviceID: string): boolean {
		return this.devices.has(deviceID);
	}
}

export class ConnectedDevicesService {
	private readonly slot = new MultiViewerSlot();

	pendingConnectionDevice: Device = nullDevice;

	private readonly availabilityListeners = new Set<
		(state: ViewerConnectionAvailability) => void
	>();

	resetPendingConnectionDevice(): void {
		this.pendingConnectionDevice = nullDevice;
	}

	getDevices(): Device[] {
		return this.slot.snapshot();
	}

	isSlotAvailable(): boolean {
		return this.slot.isAvailable();
	}

	addAvailabilityListener(
		listener: (state: ViewerConnectionAvailability) => void,
	): () => void {
		this.availabilityListeners.add(listener);
		listener(this.getAvailabilityState());
		return () => {
			this.availabilityListeners.delete(listener);
		};
	}

	disconnectAllDevices(): void {
		this.slot.release();
		this.notifyAvailabilityListeners();
	}

	disconnectDeviceByID(deviceIDToRemove: string): Promise<undefined> {
		return new Promise<undefined>((resolve) => {
			this.slot.releaseById(deviceIDToRemove);
			this.notifyAvailabilityListeners();
			resolve(undefined);
		});
	}

	addDevice(device: Device): void {
		this.slot.occupy(device);
		this.notifyAvailabilityListeners();
	}

	setPendingConnectionDevice(device: Device): void {
		this.pendingConnectionDevice = device;
	}

	private getAvailabilityState(): ViewerConnectionAvailability {
		return this.slot.isAvailable() ? 'available' : 'occupied';
	}

	private notifyAvailabilityListeners(): void {
		const state = this.getAvailabilityState();
		this.availabilityListeners.forEach((listener) => {
			try {
				listener(state);
			} catch (error) {
				console.error('connected devices availability listener failed', error);
			}
		});
	}
}
