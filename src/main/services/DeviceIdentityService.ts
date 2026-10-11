import crypto from 'node:crypto';
import type { DeviceSessionIdentity } from '../../common/types/adb';
import { store } from '../../common/deskreen-electron-store';

class DeviceIdentityService {
	private activeSessions = new Map<string, DeviceSessionIdentity>();
	private readonly STORE_KEY = 'deskreen_authorized_device_sessions';

	constructor() {
		this.loadPersistedSessions();
	}

	public loadPersistedSessions(): void {
		try {
			const raw = store.get(this.STORE_KEY);
			if (typeof raw === 'string') {
				const parsed = JSON.parse(raw) as Record<string, DeviceSessionIdentity>;
				const now = Date.now();
				const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours retention
				for (const [token, identity] of Object.entries(parsed)) {
					if (now - identity.lastSeenAt < MAX_AGE_MS) {
						this.activeSessions.set(token, identity);
					}
				}
			}
		} catch {
			// ignore malformed store
		}
	}

	public persistSessions(): void {
		try {
			const obj: Record<string, DeviceSessionIdentity> = {};
			for (const [token, identity] of this.activeSessions.entries()) {
				obj[token] = identity;
			}
			store.set(this.STORE_KEY, JSON.stringify(obj));
		} catch {
			// ignore store errors
		}
	}

	generateSessionToken(): string {
		return crypto.randomBytes(24).toString('hex');
	}

	registerSession(identity: DeviceSessionIdentity): void {
		this.activeSessions.set(identity.sessionAuthToken, {
			...identity,
			lastSeenAt: Date.now(),
		});
		this.persistSessions();
	}

	verifySession(
		sessionAuthToken: string,
		candidate: {
			deviceId?: string;
			adbSerial?: string;
			deviceIP?: string;
		},
	): boolean {
		if (!sessionAuthToken) return false;
		const session = this.activeSessions.get(sessionAuthToken);
		if (!session) return false;

		// If it's a USB connection and serial is available, verify serial
		if (candidate.adbSerial && session.adbSerial) {
			if (candidate.adbSerial !== session.adbSerial) {
				return false;
			}
		}

		// If deviceId is provided, verify deviceId
		if (candidate.deviceId && session.deviceId) {
			if (candidate.deviceId !== session.deviceId) {
				return false;
			}
		}

		// Update last seen
		session.lastSeenAt = Date.now();
		this.persistSessions();
		return true;
	}

	getSession(sessionAuthToken: string): DeviceSessionIdentity | undefined {
		const session = this.activeSessions.get(sessionAuthToken);
		if (session) {
			session.lastSeenAt = Date.now();
		}
		return session;
	}

	revokeSession(sessionAuthToken: string): void {
		this.activeSessions.delete(sessionAuthToken);
		this.persistSessions();
	}
}

export const deviceIdentityService = new DeviceIdentityService();
