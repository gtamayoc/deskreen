import { type ChildProcess, spawn } from 'node:child_process';
import os from 'node:os';

export interface RemotePointerEvent {
	type: 'tap' | 'click' | 'move' | 'down' | 'up' | 'dblclick' | 'contextmenu';
	x: number;
	y: number;
	button?: 'left' | 'right' | 'middle';
}

export interface RemoteInputPayload {
	action: 'key' | 'text' | 'macro' | 'pointer';
	key?: string;
	text?: string;
	macro?: string;
	autoEnter?: boolean;
	targetWindowTitle?: string;
	targetProcessId?: number;
	targetWindowHandle?: number | string;
	sessionId?: string;
	targetTabName?: string;
	pointer?: RemotePointerEvent;
}

export interface RemoteInputInjectionServiceOptions {
	workerFactory?: () => ChildProcess | null;
}

export class RemoteInputInjectionService {
	private psWorker: ChildProcess | null = null;
	private isInitialized = false;
	private isDestroyed = false;
	private queue: Promise<void> = Promise.resolve();
	private workerFactory?: () => ChildProcess | null;

	public constructor(options?: RemoteInputInjectionServiceOptions) {
		this.workerFactory = options?.workerFactory;
		// Lazy initialization on first input injection to prevent hanging event loops
	}

	public destroy(): void {
		this.isDestroyed = true;
		if (this.psWorker) {
			const worker = this.psWorker;
			this.psWorker = null;
			this.isInitialized = false;

			try {
				if (worker.stdin) {
					worker.stdin.on('error', () => {
						/* noop - ignore EPIPE on terminate */
					});
					if (!worker.stdin.destroyed) {
						worker.stdin.destroy();
					}
				}
				worker.on('error', () => {
					/* noop - ignore worker errors on terminate */
				});
				if (!worker.killed) {
					worker.kill();
				}
			} catch {
				/* ignore kill errors */
			}
		}
	}

	private initWindowsWorker(): void {
		if (this.isDestroyed) return;

		try {
			if (this.workerFactory) {
				this.psWorker = this.workerFactory();
			} else {
				this.psWorker = spawn(
					'powershell.exe',
					[
						'-NoProfile',
						'-NonInteractive',
						'-ExecutionPolicy',
						'Bypass',
						'-Command',
						'-',
					],
					{
						stdio: ['pipe', 'ignore', 'ignore'],
						windowsHide: true,
					},
				);
			}

			if (!this.psWorker) return;

			// Unref child process so it does not keep Node.js event loop alive
			this.psWorker.unref();
			if (
				this.psWorker.stdin &&
				'unref' in this.psWorker.stdin &&
				typeof (this.psWorker.stdin as unknown as { unref?: () => void })
					.unref === 'function'
			) {
				(
					this.psWorker.stdin as unknown as { unref: () => void }
				).unref();
			}

			this.psWorker.stdin?.on('error', () => {
				// Suppress EPIPE on child worker stdin
			});

			this.psWorker.on('error', (err) => {
				console.warn('[RemoteInput] PowerShell worker error:', err);
				this.psWorker = null;
			});

			this.psWorker.on('exit', () => {
				this.psWorker = null;
				this.isInitialized = false;
			});

			// Pre-load Windows Forms, Drawing, UI Automation, and Win32 helpers
			if (this.psWorker.stdin) {
				const initScript =
					'Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue;\n' +
					'Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue;\n' +
					'Add-Type -AssemblyName UIAutomationClient -ErrorAction SilentlyContinue;\n' +
					'Add-Type -AssemblyName UIAutomationTypes -ErrorAction SilentlyContinue;\n' +
					'try {\n' +
					'$win32Members = @\'\n' +
					'[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);\n' +
					'[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);\n' +
					'[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);\n' +
					'[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);\n' +
					'[StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }\n' +
					'[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);\n' +
					'\'@;\n' +
					'$null = Add-Type -MemberDefinition $win32Members -Name "Win32Focus" -Namespace "Deskreen" -ErrorAction SilentlyContinue -PassThru;\n' +
					'} catch {};\n' +
					'try { $global:wshell = New-Object -ComObject WScript.Shell } catch {};\n' +
					'function Focus-TerminalTab([IntPtr]$h, [string]$tabTitle) {\n' +
					'  try {\n' +
					'    if ($h -eq [IntPtr]::Zero -or [string]::IsNullOrWhiteSpace($tabTitle)) { return $false }\n' +
					'    $win = [System.Windows.Automation.AutomationElement]::FromHandle($h);\n' +
					'    if ($null -eq $win) { return $false }\n' +
					'    $cls = $win.Current.ClassName;\n' +
					'    if ($cls -ne "CASCADIA_HOSTING_WINDOW_CLASS" -and -not $cls.ToLower().Contains("cascadia")) { return $false }\n' +
					'    $tabCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::TabItem);\n' +
					'    $tabItems = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCond);\n' +
					'    if ($null -eq $tabItems -or $tabItems.Count -eq 0) { return $false }\n' +
					'    $clean = $tabTitle.Trim();\n' +
					'    $targetTab = $null;\n' +
					'    foreach ($tab in $tabItems) {\n' +
					'      if ($tab.Current.Name -and $tab.Current.Name.Trim() -ieq $clean) { $targetTab = $tab; break }\n' +
					'    }\n' +
					'    if ($null -eq $targetTab) {\n' +
					'      foreach ($tab in $tabItems) {\n' +
					'        if ($tab.Current.Name -and ($tab.Current.Name.IndexOf($clean, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $clean.IndexOf($tab.Current.Name, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)) {\n' +
					'          $targetTab = $tab; break\n' +
					'        }\n' +
					'      }\n' +
					'    }\n' +
					'    if ($null -ne $targetTab) {\n' +
					'      $pattern = $targetTab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern) -as [System.Windows.Automation.SelectionItemPattern];\n' +
					'      if ($null -ne $pattern) { $pattern.Select() } else { $targetTab.SetFocus() };\n' +
					'      return $true;\n' +
					'    }\n' +
					'  } catch {}\n' +
					'  return $false;\n' +
					'};\n';
				this.psWorker.stdin.write(initScript);
				this.isInitialized = true;
			}
		} catch (error) {
			console.warn('[RemoteInput] Failed to start persistent worker:', error);
			this.psWorker = null;
		}
	}

	private escapeForSendKeys(text: string): string {
		// In SendKeys, characters +, ^, %, ~, (, ), {, } have special meanings
		return text.replace(/([+^%~(){}[\]])/g, '{$1}');
	}

	private mapKeyToSendKeys(key: string): string {
		switch (key.toLowerCase()) {
			case 'enter':
			case 'return':
				return '{ENTER}';
			case 'tab':
				return '{TAB}';
			case 'esc':
			case 'escape':
				return '{ESC}';
			case 'backspace':
				return '{BACKSPACE}';
			case 'up':
			case 'arrowup':
				return '{UP}';
			case 'down':
			case 'arrowdown':
				return '{DOWN}';
			case 'left':
			case 'arrowleft':
				return '{LEFT}';
			case 'right':
			case 'arrowright':
				return '{RIGHT}';
			case 'ctrl+c':
				return '^c';
			case 'ctrl+v':
				return '^v';
			default:
				return this.escapeForSendKeys(key);
		}
	}

	private escapePowerShellString(text: string): string {
		return text
			.replace(/`/g, '``')
			.replace(/"/g, '`"')
			.replace(/\$/g, '`$');
	}

	public async injectInput(payload: RemoteInputPayload): Promise<boolean> {
		if (this.isDestroyed) {
			return false;
		}
		return new Promise<boolean>((resolve) => {
			this.queue = this.queue
				.then(async () => {
					if (this.isDestroyed) {
						resolve(false);
						return;
					}
					const result = await this.doInjectInput(payload);
					resolve(result);
				})
				.catch((err) => {
					console.warn('[RemoteInput] Error in injection queue:', err);
					resolve(false);
				});
		});
	}

	public async focusTerminalTab(
		targetWindowHandle: number | string,
		tabTitle: string,
	): Promise<boolean> {
		if (this.isDestroyed) return false;
		if (!targetWindowHandle) return false;
		const hwndNum =
			typeof targetWindowHandle === 'string'
				? parseInt(targetWindowHandle, 10)
				: targetWindowHandle;
		if (
			typeof hwndNum !== 'number' ||
			Number.isNaN(hwndNum) ||
			hwndNum <= 0
		) {
			return false;
		}

		return new Promise<boolean>((resolve) => {
			this.queue = this.queue
				.then(async () => {
					if (this.isDestroyed) {
						resolve(false);
						return;
					}
					const res = this.doFocusTerminalTab(hwndNum, tabTitle);
					resolve(res);
				})
				.catch(() => resolve(false));
		});
	}

	private doFocusTerminalTab(hwnd: number, tabTitle: string): boolean {
		if (this.isDestroyed || os.platform() !== 'win32') return false;
		if (typeof hwnd !== 'number' || Number.isNaN(hwnd) || hwnd <= 0) return false;
		if (!this.psWorker || !this.psWorker.stdin || !this.isInitialized) {
			this.initWindowsWorker();
		}
		const safeTitle = this.escapePowerShellString(tabTitle).trim();
		const cmd =
			`try { ` +
			`$h = [IntPtr]::new(${hwnd}); ` +
			`if ($h -ne [IntPtr]::Zero) { ` +
			`if ([Deskreen.Win32Focus]::IsIconic($h)) { $null = [Deskreen.Win32Focus]::ShowWindow($h, 9) }; ` +
			`$null = [Deskreen.Win32Focus]::SetForegroundWindow($h); ` +
			`$null = Focus-TerminalTab $h "${safeTitle}"; ` +
			`}; ` +
			`} catch {};\n`;

		try {
			if (this.psWorker?.stdin && !this.psWorker.killed) {
				this.psWorker.stdin.write(cmd);
				return true;
			}
		} catch {
			// ignore
		}
		return false;
	}

	private async doInjectInput(payload: RemoteInputPayload): Promise<boolean> {
		const platform = os.platform();

		if (payload.action === 'pointer' && payload.pointer) {
			if (platform === 'win32') {
				return this.injectPointerWindows(
					payload.pointer,
					payload.targetWindowTitle,
					payload.targetProcessId,
					payload.targetWindowHandle,
					payload.targetTabName,
				);
			}
			if (platform === 'darwin') {
				return this.injectPointerMac(
					payload.pointer,
					payload.targetWindowTitle,
				);
			}
			if (platform === 'linux') {
				return this.injectPointerLinux(
					payload.pointer,
					payload.targetWindowHandle,
				);
			}
			return false;
		}

		let keysToSend = '';

		if (typeof payload.text === 'string' && payload.text.includes('%20')) {
			try {
				payload.text = decodeURIComponent(payload.text);
			} catch {
				// ignore
			}
		}
		if (typeof payload.macro === 'string' && payload.macro.includes('%20')) {
			try {
				payload.macro = decodeURIComponent(payload.macro);
			} catch {
				// ignore
			}
		}

		if (payload.action === 'macro') {
			if (payload.macro === 'approve') {
				keysToSend = 'y{ENTER}';
			} else if (payload.macro === 'reject') {
				keysToSend = 'n{ENTER}';
			} else if (payload.macro === 'interrupt') {
				keysToSend = '^c';
			} else if (payload.macro) {
				keysToSend = this.escapeForSendKeys(payload.macro);
				if (payload.autoEnter !== false) keysToSend += '{ENTER}';
			}
		} else if (payload.action === 'key' && payload.key) {
			keysToSend = this.mapKeyToSendKeys(payload.key);
			if (
				payload.autoEnter &&
				!keysToSend.includes('{ENTER}') &&
				keysToSend !== '^c'
			) {
				keysToSend += '{ENTER}';
			}
		} else if (payload.action === 'text' && payload.text) {
			keysToSend = this.escapeForSendKeys(payload.text);
			if (payload.autoEnter !== false) {
				keysToSend += '{ENTER}';
			}
		}

		if (!keysToSend) return false;

		if (platform === 'win32') {
			return this.injectWindows(
				keysToSend,
				payload.targetWindowTitle,
				payload.targetProcessId,
				payload.targetWindowHandle,
				payload.targetTabName,
			);
		}
		if (platform === 'darwin') {
			return this.injectMac(keysToSend, payload.targetWindowTitle);
		}
		if (platform === 'linux') {
			return this.injectLinux(keysToSend, payload.targetWindowHandle);
		}

		return false;
	}

	private injectWindows(
		keysToSend: string,
		targetWindowTitle?: string,
		targetProcessId?: number,
		targetWindowHandle?: number | string,
		targetTabName?: string,
	): boolean {
		if (!this.psWorker || !this.psWorker.stdin || !this.isInitialized) {
			this.initWindowsWorker();
		}

		const safeKeys = this.escapePowerShellString(keysToSend);
		const cleanTab = this.escapePowerShellString(
			targetTabName || targetWindowTitle || '',
		).trim();
		let command = '';

		const sendKeysClause =
			`try { ` +
			`if ($null -eq $global:wshell) { $global:wshell = New-Object -ComObject WScript.Shell }; ` +
			`$global:wshell.SendKeys("${safeKeys}"); ` +
			`} catch { ` +
			`try { [System.Windows.Forms.SendKeys]::SendWait("${safeKeys}") } catch {}; ` +
			`}\n`;

		const isScreenTitle =
			targetWindowTitle &&
			/^(screen|entire screen|pantalla|pantalla completa)/i.test(
				targetWindowTitle.trim(),
			);
		const cleanTitle =
			!isScreenTitle && targetWindowTitle
				? this.escapePowerShellString(targetWindowTitle).trim()
				: '';

		if (targetWindowHandle) {
			const hwndNum =
				typeof targetWindowHandle === 'string'
					? parseInt(targetWindowHandle, 10)
					: targetWindowHandle;
			if (!Number.isNaN(hwndNum) && hwndNum > 0) {
				command =
					`try { ` +
					`$h = [IntPtr]::new(${hwndNum}); ` +
					`if ($h -ne [IntPtr]::Zero) { ` +
					`if ([Deskreen.Win32Focus]::IsIconic($h)) { $null = [Deskreen.Win32Focus]::ShowWindow($h, 9) }; ` +
					`$null = [Deskreen.Win32Focus]::SetForegroundWindow($h); ` +
					(cleanTab ? `$null = Focus-TerminalTab $h "${cleanTab}"; ` : '') +
					`}; ` +
					`if ($null -eq $global:wshell) { $global:wshell = New-Object -ComObject WScript.Shell }; ` +
					(targetProcessId && targetProcessId > 0
						? `$null = $global:wshell.AppActivate(${targetProcessId}); `
						: cleanTitle
							? `$act = $global:wshell.AppActivate("${cleanTitle}"); if (-not $act) { $prefix = "${cleanTitle}".Split('-:')[0].Trim(); if ($prefix.Length -gt 2) { $null = $global:wshell.AppActivate($prefix) } }; `
							: '') +
					`Start-Sleep -Milliseconds 50; ` +
					`} catch {}; ` +
					sendKeysClause;
			}
		}

		if (!command && targetProcessId && targetProcessId > 0) {
			command =
				`try { if ($null -eq $global:wshell) { $global:wshell = New-Object -ComObject WScript.Shell }; $null = $global:wshell.AppActivate(${targetProcessId}); Start-Sleep -Milliseconds 50; } catch {}; ` +
				sendKeysClause;
		} else if (!command && cleanTitle.length > 0) {
			command =
				`try { ` +
				`if ($null -eq $global:wshell) { $global:wshell = New-Object -ComObject WScript.Shell }; ` +
				`$act = $global:wshell.AppActivate("${cleanTitle}"); ` +
				`if (-not $act) { ` +
				`$prefix = "${cleanTitle}".Split('-:')[0].Trim(); ` +
				`if ($prefix.Length -gt 2) { $act = $global:wshell.AppActivate($prefix) } ` +
				`}; ` +
				`Start-Sleep -Milliseconds 50; ` +
				`} catch {}; ` +
				sendKeysClause;
		} else if (!command) {
			command = sendKeysClause;
		}

		try {
			if (this.psWorker && this.psWorker.stdin && !this.psWorker.killed) {
				this.psWorker.stdin.write(command);
				return true;
			}
		} catch (err) {
			console.warn('[RemoteInput] Error writing to worker stdin:', err);
		}
		return false;
	}

	private injectPointerWindows(
		pointer: NonNullable<RemoteInputPayload['pointer']>,
		targetWindowTitle?: string,
		_targetProcessId?: number,
		targetWindowHandle?: number | string,
		targetTabName?: string,
	): boolean {
		if (!this.psWorker || !this.psWorker.stdin || !this.isInitialized) {
			this.initWindowsWorker();
		}

		const normX = Math.max(0, Math.min(1, pointer.x));
		const normY = Math.max(0, Math.min(1, pointer.y));
		const cleanTitle = this.escapePowerShellString(
			targetTabName || targetWindowTitle || '',
		).trim();

		let cmd = 'try { ';

		if (targetWindowHandle) {
			const hwndNum =
				typeof targetWindowHandle === 'string'
					? parseInt(targetWindowHandle, 10)
					: targetWindowHandle;
			if (!Number.isNaN(hwndNum) && hwndNum > 0) {
				cmd +=
					`$h = [IntPtr]::new(${hwndNum}); ` +
					`if ($h -ne [IntPtr]::Zero) { ` +
					`if ([Deskreen.Win32Focus]::IsIconic($h)) { $null = [Deskreen.Win32Focus]::ShowWindow($h, 9) }; ` +
					`$null = [Deskreen.Win32Focus]::SetForegroundWindow($h); ` +
					(cleanTitle ? `$null = Focus-TerminalTab $h "${cleanTitle}"; ` : '') +
					`$rect = New-Object Deskreen.Win32Focus+RECT; ` +
					`$got = [Deskreen.Win32Focus]::GetWindowRect($h, [ref]$rect); ` +
					`if ($got) { ` +
					`$w = $rect.Right - $rect.Left; $hgt = $rect.Bottom - $rect.Top; ` +
					`$targetX = [Math]::Max($rect.Left, [Math]::Min($rect.Right, [int]($rect.Left + $w * ${normX}))); ` +
					`$targetY = [Math]::Max($rect.Top, [Math]::Min($rect.Bottom, [int]($rect.Top + $hgt * ${normY}))); ` +
					`} else { ` +
					`$targetX = [int]([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Left + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width * ${normX}); ` +
					`$targetY = [int]([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Top + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height * ${normY}); ` +
					`} ` +
					`} else { ` +
					`$targetX = [int]([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Left + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width * ${normX}); ` +
					`$targetY = [int]([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Top + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height * ${normY}); ` +
					`} `;
			} else {
				cmd +=
					`$targetX = [int]([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Left + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width * ${normX}); ` +
					`$targetY = [int]([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Top + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height * ${normY}); `;
			}
		} else {
			cmd +=
				`$targetX = [int]([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Left + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width * ${normX}); ` +
				`$targetY = [int]([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Top + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height * ${normY}); `;
		}

		cmd += `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($targetX, $targetY); `;

		if (pointer.type === 'tap' || pointer.type === 'click') {
			if (pointer.button === 'right') {
				cmd +=
					`[Deskreen.Win32Focus]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero); ` +
					`[Deskreen.Win32Focus]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero); `;
			} else {
				cmd +=
					`[Deskreen.Win32Focus]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero); ` +
					`[Deskreen.Win32Focus]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero); `;
			}
		} else if (pointer.type === 'contextmenu') {
			cmd +=
				`[Deskreen.Win32Focus]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero); ` +
				`[Deskreen.Win32Focus]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero); `;
		} else if (pointer.type === 'dblclick') {
			cmd +=
				`[Deskreen.Win32Focus]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero); ` +
				`[Deskreen.Win32Focus]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero); ` +
				`[Deskreen.Win32Focus]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero); ` +
				`[Deskreen.Win32Focus]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero); `;
		} else if (pointer.type === 'down') {
			cmd +=
				pointer.button === 'right'
					? `[Deskreen.Win32Focus]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero); `
					: `[Deskreen.Win32Focus]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero); `;
		} else if (pointer.type === 'up') {
			cmd +=
				pointer.button === 'right'
					? `[Deskreen.Win32Focus]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero); `
					: `[Deskreen.Win32Focus]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero); `;
		}

		cmd += `} catch {};\n`;

		try {
			if (this.psWorker?.stdin && !this.psWorker.killed) {
				this.psWorker.stdin.write(cmd);
				return true;
			}
		} catch (err) {
			console.warn(
				'[RemoteInput] Error writing pointer command to worker stdin:',
				err,
			);
		}
		return false;
	}

	private injectPointerMac(
		pointer: NonNullable<RemoteInputPayload['pointer']>,
		_targetWindowTitle?: string,
	): boolean {
		try {
			if (pointer.type === 'tap' || pointer.type === 'click') {
				const script = `tell application "System Events" to click`;
				const child = spawn('osascript', ['-e', script], { stdio: 'ignore' });
				child.on('error', () => {
					/* suppress unhandled error */
				});
			}
			return true;
		} catch (err) {
			console.warn('[RemoteInput] Error injecting pointer on macOS:', err);
			return false;
		}
	}

	private injectPointerLinux(
		pointer: NonNullable<RemoteInputPayload['pointer']>,
		_targetWindowHandle?: number | string,
	): boolean {
		try {
			const normX = Math.max(0, Math.min(1, pointer.x));
			const normY = Math.max(0, Math.min(1, pointer.y));
			if (pointer.type === 'tap' || pointer.type === 'click') {
				const btn = pointer.button === 'right' ? '3' : '1';
				const child = spawn('xdotool', ['click', btn], { stdio: 'ignore' });
				child.on('error', () => {
					/* suppress unhandled error */
				});
			} else if (pointer.type === 'move') {
				const child = spawn(
					'xdotool',
					[
						'mousemove_relative',
						`${Math.round(normX * 100)}`,
						`${Math.round(normY * 100)}`,
					],
					{ stdio: 'ignore' },
				);
				child.on('error', () => {
					/* suppress unhandled error */
				});
			}
			return true;
		} catch (err) {
			console.warn('[RemoteInput] Error injecting pointer on Linux:', err);
			return false;
		}
	}

	private injectMac(keysToSend: string, targetWindowTitle?: string): boolean {
		try {
			const safeKeys = keysToSend.replace(/"/g, '\\"');
			const activateScript = targetWindowTitle
				? `tell application "${targetWindowTitle.replace(/"/g, '')}" to activate`
				: '';
			const script = `${activateScript}; tell application "System Events" to keystroke "${safeKeys}"`;
			const child = spawn('osascript', ['-e', script], { stdio: 'ignore' });
			child.on('error', () => {
				/* suppress unhandled error */
			});
			return true;
		} catch (err) {
			console.warn('[RemoteInput] Error injecting on macOS:', err);
			return false;
		}
	}

	private injectLinux(
		keysToSend: string,
		targetWindowHandle?: number | string,
	): boolean {
		try {
			if (targetWindowHandle) {
				const xid = String(targetWindowHandle);
				const child = spawn('xdotool', ['windowactivate', '--sync', xid], {
					stdio: 'ignore',
				});
				child.on('error', () => {
					/* suppress unhandled error */
				});
			}
			const child = spawn('xdotool', ['type', keysToSend], { stdio: 'ignore' });
			child.on('error', () => {
				/* suppress unhandled error */
			});
			return true;
		} catch (err) {
			console.warn('[RemoteInput] Error injecting on Linux:', err);
			return false;
		}
	}
}

export const remoteInputInjectionService = new RemoteInputInjectionService();
