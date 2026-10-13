import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import {
	isKnownNonTerminalTitle,
	isNonTerminalExecutable,
	isTerminalExecutable,
	isTerminalOrConsoleSource,
	isTerminalOrConsoleTitle,
} from '../../common/terminalDetection';

const execFileAsync = promisify(execFile);

export interface WindowInspectionResult {
	isConsole: boolean;
	timestamp: number;
	executable?: string;
	windowClass?: string;
	windowTitle?: string;
	processId?: number;
	hwnd?: number;
	isWindowsTerminal?: boolean;
}

export class NativeWindowInspectionService {
	private cache = new Map<string, WindowInspectionResult>();
	private readonly ttlMs: number;

	public constructor(ttlMs = 3000) {
		this.ttlMs = ttlMs;
	}

	public clearCache(): void {
		this.cache.clear();
	}

	public getCacheSize(): number {
		return this.cache.size;
	}

	public setCacheEntry(
		sourceId: string,
		entry: Omit<WindowInspectionResult, 'timestamp'> & { timestamp?: number },
	): void {
		this.cache.set(sourceId, {
			...entry,
			timestamp: entry.timestamp ?? Date.now(),
		});
	}

	public getCacheEntry(sourceId: string): WindowInspectionResult | undefined {
		const cached = this.cache.get(sourceId);
		if (!cached) return undefined;
		if (Date.now() - cached.timestamp >= this.ttlMs) {
			this.cache.delete(sourceId);
			return undefined;
		}
		return cached;
	}

	/**
	 * Inspects a desktopCapturer window source to determine if it is a terminal or console.
	 * Utilizes a 3-second in-memory cache to guarantee zero UI latency.
	 */
	public async isTerminalWindow(
		sourceId: string,
		name?: string,
	): Promise<boolean> {
		if (!sourceId) return false;
		if (sourceId.toLowerCase().includes('screen')) return false;

		const cached = this.getCacheEntry(sourceId);
		if (cached) {
			return cached.isConsole;
		}

		// Gate Tier 1: Check if window title exhibits known non-terminal browser or editor signatures
		const hasNonTerminalTitle = name ? isKnownNonTerminalTitle(name) : false;

		// Tier 1: Fast title/prompt heuristic check ONLY if NOT a known non-terminal title
		if (name && !hasNonTerminalTitle && isTerminalOrConsoleTitle(name)) {
			this.setCacheEntry(sourceId, {
				isConsole: true,
				windowTitle: name,
			});
			return true;
		}

		// Tier 2: Native OS Inspection
		const platform = os.platform();
		let inspectedResult: {
			isConsole: boolean;
			executable?: string;
			windowClass?: string;
			processId?: number;
			hwnd?: number;
		} = { isConsole: false };

		try {
			if (platform === 'win32') {
				inspectedResult = await this.inspectWindowsWindow(sourceId, name);
			} else if (platform === 'darwin') {
				inspectedResult = await this.inspectMacWindow(sourceId, name);
			} else if (platform === 'linux') {
				inspectedResult = await this.inspectLinuxWindow(sourceId, name);
			}
		} catch (err) {
			console.warn('[NativeWindowInspectionService] Inspection error:', err);
		}

		// If native inspection identified an executable that is known non-terminal, reject immediately
		if (
			inspectedResult.executable &&
			isNonTerminalExecutable(inspectedResult.executable)
		) {
			this.setCacheEntry(sourceId, {
				isConsole: false,
				executable: inspectedResult.executable,
				windowClass: inspectedResult.windowClass,
				windowTitle: name,
				processId: inspectedResult.processId,
				hwnd: inspectedResult.hwnd,
			});
			return false;
		}

		// Tier 3: Unified fallback
		const isConsole =
			inspectedResult.isConsole ||
			isTerminalOrConsoleSource({
				name,
				id: sourceId,
				executable: inspectedResult.executable,
				windowClass: inspectedResult.windowClass,
			});

		this.setCacheEntry(sourceId, {
			isConsole,
			executable: inspectedResult.executable,
			windowClass: inspectedResult.windowClass,
			windowTitle: name,
			processId: inspectedResult.processId,
			hwnd: inspectedResult.hwnd,
		});

		return isConsole;
	}

	public getWindowProcessIdAndHandle(sourceId: string): {
		processId?: number;
		hwnd?: number;
		executable?: string;
		windowTitle?: string;
		isWindowsTerminal?: boolean;
	} {
		const cached = this.getCacheEntry(sourceId);
		const hwndMatch = sourceId.match(/^window:(\d+):/i);
		const hwnd =
			cached?.hwnd ?? (hwndMatch ? parseInt(hwndMatch[1], 10) : undefined);
		const isWindowsTerminal =
			cached?.isWindowsTerminal ??
			(cached?.executable
				? ['windowsterminal.exe', 'wt.exe'].includes(
						cached.executable.toLowerCase(),
					)
				: undefined);
		return {
			processId: cached?.processId,
			hwnd,
			executable: cached?.executable,
			windowTitle: cached?.windowTitle,
			isWindowsTerminal,
		};
	}

	public isWindowsTerminalWindow(sourceId: string): boolean {
		const details = this.getWindowProcessIdAndHandle(sourceId);
		return Boolean(details.isWindowsTerminal);
	}

	public async getWindowsTerminalTabs(hwnd: number): Promise<string[]> {
		if (os.platform() !== 'win32' || !hwnd || hwnd <= 0) return [];
		const psScript = `
			try {
				Add-Type -AssemblyName UIAutomationClient;
				$h = [IntPtr]::new(${hwnd});
				$win = [System.Windows.Automation.AutomationElement]::FromHandle($h);
				if ($win) {
					$tabCond = New-Object System.Windows.Automation.PropertyCondition(
						[System.Windows.Automation.AutomationElement]::ControlTypeProperty,
						[System.Windows.Automation.ControlType]::TabItem
					);
					$tabs = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCond);
					if ($tabs) {
						foreach ($t in $tabs) {
							if ($t.Current.Name) { Write-Output $t.Current.Name }
						}
					}
				}
			} catch {}
		`.trim();

		try {
			const { stdout } = await execFileAsync(
				'powershell.exe',
				[
					'-NoProfile',
					'-NonInteractive',
					'-ExecutionPolicy',
					'Bypass',
					'-Command',
					psScript,
				],
				{ timeout: 1500, windowsHide: true },
			);
			return stdout
				.split(/[\r\n]+/)
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
		} catch {
			return [];
		}
	}

	/**
	 * Windows native inspection via Win32 HWND resolution or process query.
	 */
	private async inspectWindowsWindow(
		sourceId: string,
		name?: string,
	): Promise<{
		isConsole: boolean;
		executable?: string;
		windowClass?: string;
		processId?: number;
		hwnd?: number;
		isWindowsTerminal?: boolean;
	}> {
		const hwndMatch = sourceId.match(/^window:(\d+):/i);
		const hwnd = hwndMatch ? parseInt(hwndMatch[1], 10) : undefined;

		// Script targeting the specific HWND if available, or searching by exact MainWindowTitle
		let psScript = '';
		if (hwnd) {
			psScript = `
				try {
					$h = [IntPtr]::new(${hwnd});
					$pidVal = 0;
					$null = Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);' -Name 'Win32_${hwnd}' -Namespace 'Deskreen' -PassThru;
					$null = [Deskreen.Win32_${hwnd}]::GetWindowThreadProcessId($h, [ref]$pidVal);
					if ($pidVal -gt 0) {
						$p = Get-Process -Id $pidVal -ErrorAction SilentlyContinue;
						if ($p) { Write-Output "$($p.ProcessName)|$($p.MainWindowTitle)|$($p.Id)" }
					}
				} catch {}
			`.trim();
		} else if (name) {
			// Single-quote escape: sanitize newlines and double all single quotes so PowerShell treats it as a verbatim literal
			const safeName = name.replace(/[\r\n]+/g, ' ').replace(/'/g, "''");
			psScript = `
				$p = Get-Process | Where-Object { $_.MainWindowTitle -eq '${safeName}' } | Select-Object -First 1;
				if ($p) { Write-Output "$($p.ProcessName)|$($p.MainWindowTitle)|$($p.Id)" }
			`.trim();
		}

		if (!psScript) {
			return { isConsole: false, hwnd };
		}

		try {
			const { stdout } = await execFileAsync(
				'powershell.exe',
				[
					'-NoProfile',
					'-NonInteractive',
					'-ExecutionPolicy',
					'Bypass',
					'-Command',
					psScript,
				],
				{ timeout: 1200, windowsHide: true },
			);

			const output = stdout.trim();
			if (output) {
				const [procName, , pidStr] = output.split('|');
				const processId = pidStr ? parseInt(pidStr.trim(), 10) : undefined;
				if (procName) {
					const exeName = `${procName.trim().toLowerCase()}.exe`;
					const isWindowsTerminal =
						exeName === 'windowsterminal.exe' || exeName === 'wt.exe';
					if (isTerminalExecutable(exeName)) {
						return {
							isConsole: true,
							executable: exeName,
							processId,
							hwnd,
							isWindowsTerminal,
						};
					}
					if (isNonTerminalExecutable(exeName)) {
						return {
							isConsole: false,
							executable: exeName,
							processId,
							hwnd,
							isWindowsTerminal: false,
						};
					}
					return {
						isConsole: false,
						executable: exeName,
						processId,
						hwnd,
						isWindowsTerminal,
					};
				}
			}
		} catch {
			// Timeout or failure, fallback safely
		}

		return { isConsole: false, hwnd };
	}

	private async inspectMacWindow(
		_sourceId: string,
		name?: string,
	): Promise<{ isConsole: boolean; executable?: string }> {
		if (!name) return { isConsole: false };
		if (isTerminalOrConsoleTitle(name)) {
			return { isConsole: true };
		}
		return { isConsole: false };
	}

	private async inspectLinuxWindow(
		_sourceId: string,
		name?: string,
	): Promise<{ isConsole: boolean; windowClass?: string }> {
		if (!name) return { isConsole: false };
		if (isTerminalOrConsoleTitle(name)) {
			return { isConsole: true };
		}
		return { isConsole: false };
	}
}

export const nativeWindowInspectionService =
	new NativeWindowInspectionService();
