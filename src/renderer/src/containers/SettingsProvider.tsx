import { SettingsContext } from '@renderer/contexts/SettingsContext';
import React, { useCallback, useEffect, useState } from 'react';

// TODO: move to 'constants' tsx file ?
export const LIGHT_UI_BACKGROUND = 'rgba(240, 248, 250, 1)';

const getInitialDarkMode = (): boolean => {
	try {
		if (
			typeof window !== 'undefined' &&
			typeof window.localStorage !== 'undefined'
		) {
			return window.localStorage.getItem('deskreen_app_dark_mode') === 'true';
		}
	} catch {
		// Safe fallback in restricted or headless environments
	}
	return false;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [currentLanguage, setCurrentLanguage] = useState('en');
	const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialDarkMode);

	const setCurrentLanguageHook = (newLang: string): void => {
		setCurrentLanguage(newLang);
	};

	const toggleDarkMode = useCallback((): void => {
		setIsDarkMode((prev) => !prev);
	}, []);

	useEffect(() => {
		try {
			if (typeof document !== 'undefined') {
				if (isDarkMode) {
					document.body.classList.add('bp3-dark');
				} else {
					document.body.classList.remove('bp3-dark');
				}
			}
			if (
				typeof window !== 'undefined' &&
				typeof window.localStorage !== 'undefined'
			) {
				window.localStorage.setItem(
					'deskreen_app_dark_mode',
					String(isDarkMode),
				);
			}
		} catch (e) {
			console.warn('Failed to update theme or localStorage:', e);
		}
	}, [isDarkMode]);

	const value = {
		currentLanguage,
		setCurrentLanguageHook,
		isDarkMode,
		toggleDarkMode,
	};

	return (
		<SettingsContext.Provider value={value}>
			{children}
		</SettingsContext.Provider>
	);
};
