import { initializeGARequestInterceptor } from './utils/gaRequestInterceptor';

// initialize GA request interceptor immediately to block requests before consent
initializeGARequestInterceptor();

import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

let savedTheme: string | null = null;
try {
	savedTheme = localStorage.getItem('deskreen_dark_mode');
} catch {
	// Storage access restricted
}
const prefersDark =
	typeof window !== 'undefined' &&
	window.matchMedia &&
	window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme === 'true' || (savedTheme !== 'false' && prefersDark)) {
	document.documentElement.classList.add('bp3-dark');
	document.body.classList.add('bp3-dark');
} else {
	document.documentElement.classList.remove('bp3-dark');
	document.body.classList.remove('bp3-dark');
}
import './config/i18n';
import App from './App.tsx';
import { AppContextProvider } from './providers/AppContextProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import LoadingScreen from './components/LoadingScreen';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Suspense fallback={<LoadingScreen />}>
			<AppContextProvider>
				<ThemeProvider>
					<App />
				</ThemeProvider>
			</AppContextProvider>
		</Suspense>
	</StrictMode>,
);
