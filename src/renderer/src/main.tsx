// override console early to catch all logs in renderer
import {
	overrideGlobalConsole,
	startConsoleRateLimiting,
} from '../../common/rateLimitedConsole';
overrideGlobalConsole();
startConsoleRateLimiting();

import './assets/main.css';

if (localStorage.getItem('deskreen_app_dark_mode') === 'true') {
	document.body.classList.add('bp3-dark');
}

import { createRoot } from 'react-dom/client';
import { StrictMode, Suspense } from 'react';
import Root from './containers/Root';
import { i18nInitPromise } from './configs/i18next.config.client';

document.addEventListener('DOMContentLoaded', () => {
	const windowTopBar = document.createElement('div');
	windowTopBar.style.width = '75%';
	windowTopBar.style.height = '50px';
	windowTopBar.style.position = 'absolute';
	windowTopBar.style.top = '0';
	windowTopBar.style.left = '0';
	// @ts-ignore: all good here
	windowTopBar.style.webkitAppRegion = 'drag';
	windowTopBar.style.pointerEvents = 'none';

	document.body.appendChild(windowTopBar);
});

i18nInitPromise
	.catch((err) => {
		console.warn('i18nInitPromise failed to initialize:', err);
	})
	.finally(() => {
		const rootEl = document.getElementById('root');
		if (rootEl) {
			createRoot(rootEl).render(
				<StrictMode>
					<Suspense fallback="loading">
						<Root />
					</Suspense>
				</StrictMode>,
			);
		}
	});
// });

window.onbeforeunload = () => {
	window.electron.ipcRenderer.invoke('main-window-onbeforeunload');
};
