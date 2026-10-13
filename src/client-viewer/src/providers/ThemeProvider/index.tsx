import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
} from 'react';
import { Classes } from '@blueprintjs/core';

export type ThemePreference = 'system' | 'dark' | 'light';

export interface ThemeContextType {
	isDarkMode: boolean;
	themePreference: ThemePreference;
	toggleDarkMode: () => void;
	setThemePreference: (pref: ThemePreference) => void;
}

const STORAGE_KEY = 'deskreen_dark_mode';

export function getSystemPrefersDark(): boolean {
	if (typeof window !== 'undefined' && window.matchMedia) {
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	}
	return false;
}

export function getInitialDarkMode(): boolean {
	try {
		if (typeof window !== 'undefined' && window.location) {
			const params = new URLSearchParams(window.location.search);
			const themeParam = params.get('theme') || params.get('dark');
			if (
				themeParam === 'dark' ||
				themeParam === 'true' ||
				themeParam === '1'
			) {
				try {
					localStorage.setItem(STORAGE_KEY, 'true');
				} catch {
					// ignore localStorage restrictions
				}
				return true;
			}
			if (
				themeParam === 'light' ||
				themeParam === 'false' ||
				themeParam === '0'
			) {
				try {
					localStorage.setItem(STORAGE_KEY, 'false');
				} catch {
					// ignore localStorage restrictions
				}
				return false;
			}
		}
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'true') return true;
		if (saved === 'false') return false;
	} catch {
		// Handle restricted environments / private browsing mode
	}
	return getSystemPrefersDark();
}

export const ThemeContext = createContext<ThemeContextType>({
	isDarkMode: false,
	themePreference: 'system',
	toggleDarkMode: () => {
		// Default no-op before provider mounts
	},
	setThemePreference: () => {
		// Default no-op before provider mounts
	},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialDarkMode);
	const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
		() => {
			try {
				const saved = localStorage.getItem(STORAGE_KEY);
				if (saved === 'true') return 'dark';
				if (saved === 'false') return 'light';
			} catch {
				// Ignore storage access errors
			}
			return 'system';
		},
	);

	// Synchronize document.body, documentElement, color-scheme, and meta theme-color
	useEffect(() => {
		if (isDarkMode) {
			document.documentElement.classList.add(Classes.DARK, 'bp3-dark');
			document.body.classList.add(Classes.DARK, 'bp3-dark');
			document.documentElement.style.colorScheme = 'dark';
		} else {
			document.documentElement.classList.remove(Classes.DARK, 'bp3-dark');
			document.body.classList.remove(Classes.DARK, 'bp3-dark');
			document.documentElement.style.colorScheme = 'light';
		}

		if (typeof document !== 'undefined') {
			let meta = document.querySelector('meta[name="theme-color"]');
			if (!meta) {
				meta = document.createElement('meta');
				meta.setAttribute('name', 'theme-color');
				document.head.appendChild(meta);
			}
			meta.setAttribute('content', isDarkMode ? '#182026' : '#f4f8fa');
		}
	}, [isDarkMode]);

	// Listen to OS prefers-color-scheme changes
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

		const handleChange = (e: MediaQueryListEvent) => {
			try {
				const saved = localStorage.getItem(STORAGE_KEY);
				if (saved !== 'true' && saved !== 'false') {
					setIsDarkMode(e.matches);
				}
			} catch {
				setIsDarkMode(e.matches);
			}
		};

		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener('change', handleChange);
		} else if (
			'addListener' in mediaQuery &&
			typeof (mediaQuery as { addListener: unknown }).addListener === 'function'
		) {
			(
				mediaQuery as {
					addListener: (listener: (e: MediaQueryListEvent) => void) => void;
				}
			).addListener(handleChange);
		}

		return () => {
			if (mediaQuery.removeEventListener) {
				mediaQuery.removeEventListener('change', handleChange);
			} else if (
				'removeListener' in mediaQuery &&
				typeof (mediaQuery as { removeListener: unknown }).removeListener ===
					'function'
			) {
				(
					mediaQuery as {
						removeListener: (
							listener: (e: MediaQueryListEvent) => void,
						) => void;
					}
				).removeListener(handleChange);
			}
		};
	}, []);

	// Synchronize with external changes across tabs/windows
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const handleStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) {
				if (e.newValue === 'true') {
					setIsDarkMode(true);
					setThemePreferenceState('dark');
				} else if (e.newValue === 'false') {
					setIsDarkMode(false);
					setThemePreferenceState('light');
				} else {
					setIsDarkMode(getSystemPrefersDark());
					setThemePreferenceState('system');
				}
			}
		};

		window.addEventListener('storage', handleStorage);
		return () => {
			window.removeEventListener('storage', handleStorage);
		};
	}, []);

	const toggleDarkMode = useCallback(() => {
		setIsDarkMode((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(STORAGE_KEY, String(next));
			} catch {
				// Ignore storage access errors
			}
			setThemePreferenceState(next ? 'dark' : 'light');
			return next;
		});
	}, []);

	const setThemePreference = useCallback((pref: ThemePreference) => {
		setThemePreferenceState(pref);
		try {
			if (pref === 'system') {
				localStorage.removeItem(STORAGE_KEY);
				setIsDarkMode(getSystemPrefersDark());
			} else {
				localStorage.setItem(STORAGE_KEY, pref === 'dark' ? 'true' : 'false');
				setIsDarkMode(pref === 'dark');
			}
		} catch {
			// Ignore storage access errors
		}
	}, []);

	return (
		<ThemeContext.Provider
			value={{
				isDarkMode,
				themePreference,
				toggleDarkMode,
				setThemePreference,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
