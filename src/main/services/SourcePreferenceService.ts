import { screen } from 'electron';
import { store } from '../../common/deskreen-electron-store';
import { ElectronStoreKeys } from '../../common/ElectronStoreKeys.enum';
import { SavedSourceConfig } from '../../common/SavedSourceConfig';
import DesktopCapturerSourceType from '../../common/DesktopCapturerSourceType';
import { getDeskreenGlobal } from '../helpers/getDeskreenGlobal';

export class SourcePreferenceService {
	public getSavedSourcePreference(): SavedSourceConfig | null {
		try {
			const raw = store.get(ElectronStoreKeys.LastSelectedSource);
			if (!raw) return null;
			return JSON.parse(raw) as SavedSourceConfig;
		} catch (error) {
			console.warn('Failed to parse saved source preference:', error);
			return null;
		}
	}

	public async saveSourcePreference(sourceId: string): Promise<void> {
		if (!sourceId) return;
		try {
			const sourcesService = getDeskreenGlobal().desktopCapturerSourcesService;
			let sourceItem = sourcesService?.sources?.get(sourceId);
			if (!sourceItem && sourcesService) {
				await sourcesService.refreshDesktopCapturerSources();
				sourceItem = sourcesService.sources?.get(sourceId);
			}

			const isScreen = sourceId.includes(DesktopCapturerSourceType.SCREEN);
			const config: SavedSourceConfig = {
				sourceId,
				displayId: sourceItem?.source.display_id || '',
				sourceName: sourceItem?.source.name || '',
				sourceType: isScreen ? 'screen' : 'window',
			};

			store.set(ElectronStoreKeys.LastSelectedSource, JSON.stringify(config));
		} catch (error) {
			console.error('Failed to save source preference:', error);
		}
	}

	public async resolveInitialSharingSource(): Promise<string> {
		const sourcesService = getDeskreenGlobal().desktopCapturerSourcesService;
		try {
			if (sourcesService) {
				await sourcesService.refreshDesktopCapturerSources();
			}
		} catch (err) {
			console.warn(
				'Error refreshing capturer sources during source resolution:',
				err,
			);
		}

		const screenSources = sourcesService
			? sourcesService.getScreenSources()
			: [];
		const appWindowSources = sourcesService
			? sourcesService.getAppWindowSources()
			: [];
		const saved = this.getSavedSourcePreference();

		// 1. Try restoring saved preference if available
		if (saved) {
			if (saved.sourceType === 'screen') {
				// Match by display_id first (robust against index reordering)
				if (saved.displayId) {
					const matchedByDisplayId = screenSources.find(
						(s) => s.display_id === saved.displayId,
					);
					if (matchedByDisplayId) {
						if (matchedByDisplayId.id !== saved.sourceId) {
							await this.saveSourcePreference(matchedByDisplayId.id);
						}
						return matchedByDisplayId.id;
					}
				}
				// Match by sourceId
				const matchedById = screenSources.find((s) => s.id === saved.sourceId);
				if (matchedById) {
					return matchedById.id;
				}
				// Match by name
				if (saved.sourceName) {
					const matchedByName = screenSources.find(
						(s) => s.name === saved.sourceName,
					);
					if (matchedByName) {
						return matchedByName.id;
					}
				}
			} else if (saved.sourceType === 'window') {
				const matchedWindow = appWindowSources.find(
					(s) =>
						s.id === saved.sourceId ||
						(saved.sourceName && s.name === saved.sourceName),
				);
				if (matchedWindow) {
					return matchedWindow.id;
				}
			}
		}

		// 2. Fallback to Primary Display
		if (screenSources.length > 0) {
			try {
				const primaryDisplay = screen.getPrimaryDisplay();
				if (primaryDisplay) {
					const primaryDisplayId = String(primaryDisplay.id);
					const matchedPrimary = screenSources.find(
						(s) => s.display_id === primaryDisplayId,
					);
					if (matchedPrimary) {
						await this.saveSourcePreference(matchedPrimary.id);
						return matchedPrimary.id;
					}
				}
			} catch (e) {
				console.warn('Failed to query electron screen.getPrimaryDisplay:', e);
			}

			// Fallback to "Entire screen" / "Screen 1" or screenSources[0]
			const fallbackScreen =
				screenSources.find((s) => {
					const nameLower = s.name.toLowerCase();
					return (
						nameLower.includes('entire screen') ||
						nameLower.includes('pantalla') ||
						nameLower.includes('screen 1')
					);
				}) || screenSources[0];

			if (fallbackScreen) {
				await this.saveSourcePreference(fallbackScreen.id);
				return fallbackScreen.id;
			}
		}

		return '';
	}
}

export const sourcePreferenceService = new SourcePreferenceService();
