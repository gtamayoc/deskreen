import { type ChildProcess, spawn } from 'node:child_process';
import os from 'node:os';

export interface RemoteInputPayload {
	action: 'key' | 'text' | 'macro';
	key?: string;
	text?: string;
	macro?: string;
	autoEnter?: boolean;
	targetWindowTitle?: string;
}

export class RemoteInputInjectionService {
	private psWorker: ChildProcess | null = null;
	private isInitialized = false;

	public constructor() {
		if (os.platform() === 'win32') {
			this.initWindowsWorker();
		}
	}

	private initWindowsWorker(): void {
		try {
			this.psWorker = spawn(
				'powershell.exe',
				['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
				{
					stdio: ['pipe', 'ignore', 'ignore'],
					windowsHide: true,
				},
			);

			this.psWorker.on('error', (err) => {
				console.warn('[RemoteInput] PowerShell worker error:', err);
				this.psWorker = null;
			});

			this.psWorker.on('exit', () => {
				this.psWorker = null;
				this.isInitialized = false;
			});

			// Pre-load Windows Forms assembly in worker
			if (this.psWorker.stdin) {
				this.psWorker.stdin.write('Add-Type -AssemblyName System.Windows.Forms\n');
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

	public async injectInput(payload: RemoteInputPayload): Promise<boolean> {
		const platform = os.platform();
		let keysToSend = '';

		if (
			typeof payload.text === 'string' &&
			payload.text.includes('%20')
		) {
			try {
				payload.text = decodeURIComponent(payload.text);
			} catch {
				// ignore
			}
		}
		if (
			typeof payload.macro === 'string' &&
			payload.macro.includes('%20')
		) {
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
			if (payload.autoEnter && !keysToSend.includes('{ENTER}') && keysToSend !== '^c') {
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
			return this.injectWindows(keysToSend, payload.targetWindowTitle);
		}
		if (platform === 'darwin') {
			return this.injectMac(keysToSend, payload.targetWindowTitle);
		}
		if (platform === 'linux') {
			return this.injectLinux(keysToSend);
		}

		return false;
	}

	private injectWindows(keysToSend: string, targetWindowTitle?: string): boolean {
		if (!this.psWorker || !this.psWorker.stdin || !this.isInitialized) {
			this.initWindowsWorker();
		}

		const safeKeys = keysToSend.replace(/"/g, '`"');
		let command = '';

		if (targetWindowTitle && targetWindowTitle.trim().length > 0) {
			// Clean window title (remove trailing or leading noise)
			const cleanTitle = targetWindowTitle.replace(/"/g, '`"').trim();
			command = `$wshell = New-Object -ComObject WScript.Shell; $null = $wshell.AppActivate("${cleanTitle}"); [System.Windows.Forms.SendKeys]::SendWait("${safeKeys}")\n`;
		} else {
			command = `[System.Windows.Forms.SendKeys]::SendWait("${safeKeys}")\n`;
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

	private injectMac(keysToSend: string, targetWindowTitle?: string): boolean {
		try {
			const safeKeys = keysToSend.replace(/"/g, '\\"');
			const activateScript = targetWindowTitle
				? `tell application "${targetWindowTitle.replace(/"/g, '')}" to activate`
				: '';
			const script = `${activateScript}; tell application "System Events" to keystroke "${safeKeys}"`;
			spawn('osascript', ['-e', script], { stdio: 'ignore' });
			return true;
		} catch (err) {
			console.warn('[RemoteInput] Error injecting on macOS:', err);
			return false;
		}
	}

	private injectLinux(keysToSend: string): boolean {
		try {
			spawn('xdotool', ['type', keysToSend], { stdio: 'ignore' });
			return true;
		} catch (err) {
			console.warn('[RemoteInput] Error injecting on Linux:', err);
			return false;
		}
	}
}

export const remoteInputInjectionService =
	new RemoteInputInjectionService();
