/**
 * Web Screen Orientation API helper for client-viewer.
 * Allows requesting native orientation lock (landscape/portrait) when in fullscreen mode.
 */

type LockableScreenOrientation = ScreenOrientation & {
	lock?: (orientation: 'landscape' | 'portrait' | string) => Promise<void>;
};

const getLockableOrientation = (): LockableScreenOrientation | null => {
	if (
		typeof window !== 'undefined' &&
		'screen' in window &&
		'orientation' in window.screen
	) {
		return window.screen.orientation as LockableScreenOrientation;
	}
	return null;
};

export const isOrientationLockSupported = (): boolean => {
	const orientation = getLockableOrientation();
	return typeof orientation?.lock === 'function';
};

export const getCurrentOrientationType = (): string => {
	const orientation = getLockableOrientation();
	if (orientation?.type) {
		return orientation.type;
	}
	if (typeof window !== 'undefined') {
		return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
	}
	return 'landscape';
};

export const lockOrientation = async (
	target: 'landscape' | 'portrait',
): Promise<boolean> => {
	const orientation = getLockableOrientation();
	if (!orientation || typeof orientation.lock !== 'function') {
		return false;
	}
	try {
		const orientationParam = target === 'landscape' ? 'landscape' : 'portrait';
		await orientation.lock(orientationParam);
		return true;
	} catch (err) {
		console.warn('screen.orientation.lock failed or not permitted:', err);
		return false;
	}
};

export const unlockOrientation = (): void => {
	const orientation = getLockableOrientation();
	if (orientation && typeof orientation.unlock === 'function') {
		try {
			orientation.unlock();
		} catch (err) {
			console.warn('screen.orientation.unlock failed:', err);
		}
	}
};

export const toggleOrientation = async (): Promise<
	'landscape' | 'portrait' | 'unsupported'
> => {
	if (!isOrientationLockSupported()) {
		return 'unsupported';
	}
	const current = getCurrentOrientationType();
	const isLandscape = current.includes('landscape');
	const nextTarget: 'landscape' | 'portrait' = isLandscape
		? 'portrait'
		: 'landscape';
	const success = await lockOrientation(nextTarget);
	if (!success) {
		return 'unsupported';
	}
	return nextTarget;
};
