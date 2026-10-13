import { type Display, type Rectangle, screen } from 'electron';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import Logger from '../../utils/LoggerWithFilePrefix';

export interface VirtualDisplayStatus {
	totalDisplays: number;
	hasSecondaryDisplay: boolean;
	displays: Array<{
		id: number;
		bounds: Rectangle;
		isPrimary: boolean;
	}>;
}

export interface WindowPlacementResult {
	success: boolean;
	message?: string;
	originalBounds?: Rectangle;
	targetDisplayId?: string;
}

export class VirtualDisplayService {
	private log = new Logger(__filename);
	private isProvisioning = false;
	private originalWindowBoundsMap: Map<string, Rectangle> = new Map();

	public getStatus(): VirtualDisplayStatus {
		const allDisplays = screen.getAllDisplays();
		const primaryDisplay = screen.getPrimaryDisplay();

		return {
			totalDisplays: allDisplays.length,
			hasSecondaryDisplay: allDisplays.length > 1,
			displays: allDisplays.map((d: Display) => ({
				id: d.id,
				bounds: d.bounds,
				isPrimary: d.id === primaryDisplay.id,
			})),
		};
	}

	public async ensureVirtualDisplay(): Promise<{
		success: boolean;
		message: string;
		displayAdded: boolean;
	}> {
		if (this.getStatus().hasSecondaryDisplay) {
			return {
				success: true,
				message: 'Secondary or virtual display is already available',
				displayAdded: false,
			};
		}

		if (this.isProvisioning) {
			return {
				success: true,
				message: 'Virtual display provisioning already in progress',
				displayAdded: false,
			};
		}

		if (os.platform() !== 'win32') {
			return {
				success: false,
				message:
					'Automated provisioning script is currently configured for Windows',
				displayAdded: false,
			};
		}

		this.isProvisioning = true;
		this.log.info(
			'Only 1 display detected. Launching automated virtual display script...',
		);

		return new Promise((resolve) => {
			try {
				const scriptPath = path.resolve(
					process.cwd(),
					'scripts',
					'setup-virtual-display.ps1',
				);

				const ps = spawn(
					'powershell.exe',
					[
						'-NoProfile',
						'-NonInteractive',
						'-ExecutionPolicy',
						'Bypass',
						'-File',
						scriptPath,
					],
					{
						windowsHide: true,
					},
				);

				let stdout = '';
				let stderr = '';

				ps.stdout?.on('data', (data) => {
					stdout += data.toString();
				});

				ps.stderr?.on('data', (data) => {
					stderr += data.toString();
				});

				ps.on('close', (code) => {
					this.isProvisioning = false;
					this.log.info(
						`Virtual display script exited with code ${code}. Output: ${stdout}`,
					);
					if (stderr) {
						this.log.warn(`Virtual display script stderr: ${stderr}`);
					}

					const statusAfter = this.getStatus();
					resolve({
						success: code === 0 || statusAfter.hasSecondaryDisplay,
						message: statusAfter.hasSecondaryDisplay
							? 'Virtual display provisioned successfully'
							: 'Script executed. Please ensure a virtual display driver or HDMI dummy plug is configured.',
						displayAdded: statusAfter.hasSecondaryDisplay,
					});
				});

				ps.on('error', (err) => {
					this.isProvisioning = false;
					this.log.error(
						'Failed to spawn virtual display provisioning script',
						err,
					);
					resolve({
						success: false,
						message: `Failed to execute script: ${err.message}`,
						displayAdded: false,
					});
				});
			} catch (error) {
				this.isProvisioning = false;
				const message = error instanceof Error ? error.message : String(error);
				this.log.error('Exception during ensureVirtualDisplay', error);
				resolve({
					success: false,
					message,
					displayAdded: false,
				});
			}
		});
	}

	public async moveWindowToVirtualDisplay(
		windowTitle: string,
	): Promise<WindowPlacementResult> {
		if (os.platform() !== 'win32') {
			return {
				success: false,
				message: 'Window placement helper is available on Windows',
			};
		}

		const status = this.getStatus();
		const secondaryDisplay = status.displays.find((d) => !d.isPrimary);

		if (!secondaryDisplay) {
			return {
				success: false,
				message: 'No secondary or virtual display available to place window',
			};
		}

		const targetBounds = secondaryDisplay.bounds;
		const width = Math.max(1920, targetBounds.width);
		const height = Math.max(1080, targetBounds.height);
		const targetX = targetBounds.x;
		const targetY = targetBounds.y;

		return new Promise((resolve) => {
			const psCommand = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32Window {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  }
"@
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${windowTitle.replace(/"/g, '`"')}*" -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($proc) {
  $hwnd = $proc.MainWindowHandle
  [Win32Window]::ShowWindow($hwnd, 9) # SW_RESTORE
  [Win32Window]::SetWindowPos($hwnd, [IntPtr]::Zero, ${targetX}, ${targetY}, ${width}, ${height}, 0x0040)
  Write-Output "MOVED"
} else {
  Write-Output "WINDOW_NOT_FOUND"
}
`;

			try {
				const ps = spawn(
					'powershell.exe',
					[
						'-NoProfile',
						'-NonInteractive',
						'-ExecutionPolicy',
						'Bypass',
						'-Command',
						psCommand,
					],
					{ windowsHide: true },
				);

				let output = '';
				ps.stdout?.on('data', (d) => {
					output += d.toString();
				});

				ps.on('close', () => {
					if (output.includes('MOVED')) {
						this.originalWindowBoundsMap.set(windowTitle, targetBounds);
						resolve({
							success: true,
							targetDisplayId: String(secondaryDisplay.id),
						});
					} else {
						resolve({
							success: false,
							message: 'Window not found or could not be moved',
						});
					}
				});

				ps.on('error', (err) => {
					resolve({
						success: false,
						message: err.message,
					});
				});
			} catch (err) {
				resolve({
					success: false,
					message: err instanceof Error ? err.message : String(err),
				});
			}
		});
	}

	public async restoreWindow(windowTitle: string): Promise<boolean> {
		if (os.platform() !== 'win32') return false;

		const primaryDisplay = screen.getPrimaryDisplay();
		const pBounds = primaryDisplay.bounds;
		const x = pBounds.x + 50;
		const y = pBounds.y + 50;
		const width = Math.min(1280, pBounds.width - 100);
		const height = Math.min(720, pBounds.height - 100);

		return new Promise((resolve) => {
			const psCommand = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32Window {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  }
"@
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${windowTitle.replace(/"/g, '`"')}*" -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($proc) {
  $hwnd = $proc.MainWindowHandle
  [Win32Window]::ShowWindow($hwnd, 9)
  [Win32Window]::SetWindowPos($hwnd, [IntPtr]::Zero, ${x}, ${y}, ${width}, ${height}, 0x0040)
  Write-Output "RESTORED"
}
`;
			try {
				const ps = spawn(
					'powershell.exe',
					[
						'-NoProfile',
						'-NonInteractive',
						'-ExecutionPolicy',
						'Bypass',
						'-Command',
						psCommand,
					],
					{ windowsHide: true },
				);
				let output = '';
				ps.stdout?.on('data', (d) => {
					output += d.toString();
				});
				ps.on('close', () => {
					this.originalWindowBoundsMap.delete(windowTitle);
					resolve(output.includes('RESTORED'));
				});
				ps.on('error', () => resolve(false));
			} catch {
				resolve(false);
			}
		});
	}
}

export const virtualDisplayService = new VirtualDisplayService();
