/**
 * Terminal & Console Detection Engine
 *
 * Detects if a window, process, or source corresponds to a command-line interface,
 * shell, or terminal emulator (e.g. Windows Terminal, PowerShell, cmd.exe, Git Bash,
 * WSL, Alacritty, WezTerm, iTerm2, gnome-terminal, kitty, etc.)
 *
 * Supports multi-tier detection:
 * 1. Process Executable name (wt.exe, cmd.exe, powershell.exe, mintty.exe, etc.)
 * 2. Window Class name (ConsoleWindowClass, CASCADIA_HOSTING_WINDOW_CLASS, mintty, etc.)
 * 3. Window title / dynamic prompt heuristics (user@host, virtual environments, elevated prompts, CLI tools)
 */

export const KNOWN_TERMINAL_EXECUTABLES: ReadonlySet<string> = new Set([
	// Windows
	'windowsterminal.exe',
	'wt.exe',
	'openconsole.exe',
	'conhost.exe',
	'cmd.exe',
	'powershell.exe',
	'pwsh.exe',
	'mintty.exe',
	'bash.exe',
	'wsl.exe',
	'wslhost.exe',
	'alacritty.exe',
	'wezterm-gui.exe',
	'wezterm.exe',
	'kitty.exe',
	'hyper.exe',
	'tabby.exe',
	'ghostty.exe',
	'warp.exe',
	'putty.exe',
	'mobaxterm.exe',
	'cmder.exe',
	'conemu64.exe',
	'conemu.exe',

	// Shell binaries (cross-platform & Unix/Linux/macOS without .exe)
	'bash',
	'zsh',
	'sh',
	'fish',
	'pwsh',
	'cmd',
	'powershell',
	'wsl',
	'csh',
	'tcsh',
	'dash',
	'ksh',
	'nu',
	'elvish',
	'xonsh',

	// macOS / Linux binaries (without .exe)
	'terminal',
	'iterm',
	'iterm2',
	'alacritty',
	'kitty',
	'wezterm-gui',
	'wezterm',
	'hyper',
	'tabby',
	'ghostty',
	'warp',
	'warp-terminal',
	'putty',
	'gnome-terminal-server',
	'gnome-terminal',
	'konsole',
	'xfce4-terminal',
	'foot',
	'tilix',
	'terminator',
	'urxvt',
	'rxvt',
	'xterm',
	'st',
	'lxterminal',
	'mate-terminal',
	'rio',
	'wave',
	'termius',
]);

export const KNOWN_NON_TERMINAL_EXECUTABLES: ReadonlySet<string> = new Set([
	// Web Browsers
	'chrome.exe',
	'chrome',
	'msedge.exe',
	'msedge',
	'firefox.exe',
	'firefox',
	'brave.exe',
	'brave',
	'opera.exe',
	'opera',
	'vivaldi.exe',
	'vivaldi',
	'safari',
	'chromium.exe',
	'chromium',

	// Code Editors & IDEs (GUI editors)
	'code.exe',
	'code',
	'devenv.exe',
	'idea64.exe',
	'idea',
	'pycharm64.exe',
	'pycharm',
	'webstorm64.exe',
	'webstorm',
	'sublime_text.exe',
	'sublime_text',
	'atom.exe',
	'atom',

	// Text Editors & System Utilities
	'notepad.exe',
	'notepad',
	'notepad++.exe',
	'notepad++',
	'explorer.exe',
	'explorer',

	// Office & Productivity
	'winword.exe',
	'excel.exe',
	'powerpnt.exe',
	'outlook.exe',
	'onenote.exe',

	// Communication & Media
	'slack.exe',
	'slack',
	'discord.exe',
	'discord',
	'spotify.exe',
	'spotify',
	'teams.exe',
	'teams',
	'thunderbird.exe',
	'thunderbird',
]);

/**
 * Common non-terminal window title signatures (e.g. browser tab suffixes or editor titles)
 */
export const KNOWN_NON_TERMINAL_TITLE_PATTERNS: RegExp[] = [
	/(?: - Google Chrome| - Microsoft\s*Edge| - Chromium| - Mozilla Firefox| - Brave| - Opera| - Vivaldi)$/i,
	/(?: - Visual Studio Code| - Sublime Text| - Notepad(?:\+\+)?)$/i,
];

export const KNOWN_TERMINAL_CLASSES: ReadonlySet<string> = new Set([
	'consolewindowclass',
	'cascadia_hosting_window_class',
	'mintty',
	'virtualconsoleclass',
	'conemumain',
	'alacritty',
	'org.wezfurlong.wezterm',
	'putty',
	'kitty',
]);

const UNIVERSAL_TERMINAL_PATTERNS: RegExp[] = [
	// Windows Command Prompt / Símbolo del sistema
	/\bcmd(\.exe)?\b/i,
	/s[ií]mbolo del sistema/i,
	/command prompt/i,

	// PowerShell
	/\bpowershell(\.exe)?\b/i,
	/\bpwsh(\.exe)?\b/i,
	/windows powershell/i,

	// Windows Terminal & Consoles
	/\bwindows terminal\b/i,
	/\bterminal\b/i,
	/\bconsole\b/i,
	/\bconsola\b/i,

	// Unix / Linux / macOS shells & emulators on Windows
	/\bgit bash\b/i,
	/\bmingw(64|32)?\b/i,
	/\bmsys(2)?\b/i,
	/\bcygwin\b/i,
	/\bconemu\b/i,
	/\bcmder\b/i,
	/\bmintty\b/i,
	/\balacritty\b/i,
	/\bwezterm\b/i,
	/\bkitty\b/i,
	/\bhyper\b/i,
	/\btabby\b/i,
	/\biterm(2)?\b/i,
	/\bgnome-terminal\b/i,
	/\bkonsole\b/i,
	/\bxfce4-terminal\b/i,
	/\btilix\b/i,
	/\bterminator\b/i,
	/\bxterm\b/i,
	/\bghostty\b/i,
	/\bwarp\b/i,
	/\bputty\b/i,
	/\bmobaxterm\b/i,

	// Shells
	/\b(bash|zsh|fish|sh|wsl)(\.exe)?\b/i,

	// Prompts: user@host, e.g. root@server: / user@laptop: ~
	/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+[:#$]/i,

	// Elevated Prompts (Windows / localized)
	/^(?:select\s+|seleccionar\s+)?(?:administrator|administrador|admin):\s*/i,

	// PowerShell directory prompts: PS C:\... or PS /home/...
	/^PS\s+[A-Za-z]:\\/i,
	/^PS\s+\//i,

	// Virtual environments / Conda prefix: (venv) or (base)
	/^\([^)]+\)\s+/i,

	// Windows absolute path formatted titles commonly set by Windows Terminal tabs
	/^[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/,

	// CLI orchestration / agent runners / dev tools commonly running in console
	/\bralph(-tui)?\b/i,
	/\bclaude\b/i,
	/\baider\b/i,
	/\bipython\b/i,
	/\bcodex\b/i,
	/\bollama\b/i,
	/\bvim\b/i,
	/\bnvim\b/i,
	/\bnano\b/i,
	/\btmux\b/i,
	/\bzellij\b/i,
	/\bhtop\b/i,
	/\bbtop\b/i,
	/\blazygit\b/i,
	/\blazydocker\b/i,
	/\bk9s\b/i,
	/\bdocker\b/i,
	/\bnpm(\s+(run|test|start|exec|dev))?\b/i,
	/\bnpx\b/i,
	/\bpnpm\b/i,
	/\byarn\b/i,
	/\bbun\b/i,
	/\bcargo(\s+(run|test|build))?\b/i,
	/\bpytest\b/i,

	// Common shell script extensions in title
	/\.(sh|bash|zsh|bat|cmd|ps1)\b/i,
];

/**
 * Checks if an executable file name corresponds to a known terminal or shell emulator.
 */
export function isTerminalExecutable(executable?: string | null): boolean {
	if (!executable || typeof executable !== 'string') {
		return false;
	}
	const clean = executable.trim().toLowerCase();
	if (!clean) return false;

	// Extract filename from full path if path was provided
	const fileName = clean.split(/[/\\]/).pop() || clean;
	if (KNOWN_TERMINAL_EXECUTABLES.has(fileName)) {
		return true;
	}

	// Try without .exe extension
	const baseName = fileName.replace(/\.exe$/i, '');
	if (KNOWN_TERMINAL_EXECUTABLES.has(baseName)) {
		return true;
	}

	// Also try with .exe appended
	return KNOWN_TERMINAL_EXECUTABLES.has(`${baseName}.exe`);
}

/**
 * Checks if a window class name corresponds to a known terminal window class.
 */
export function isTerminalWindowClass(windowClass?: string | null): boolean {
	if (!windowClass || typeof windowClass !== 'string') {
		return false;
	}
	const clean = windowClass.trim().toLowerCase();
	if (!clean) return false;

	return KNOWN_TERMINAL_CLASSES.has(clean);
}

/**
 * Checks if an executable file name corresponds to a known non-terminal application.
 */
export function isNonTerminalExecutable(executable?: string | null): boolean {
	if (!executable || typeof executable !== 'string') {
		return false;
	}
	const clean = executable.trim().toLowerCase();
	if (!clean) return false;

	const fileName = clean.split(/[/\\]/).pop() || clean;
	if (KNOWN_NON_TERMINAL_EXECUTABLES.has(fileName)) {
		return true;
	}
	const baseName = fileName.replace(/\.exe$/i, '');
	return (
		KNOWN_NON_TERMINAL_EXECUTABLES.has(baseName) ||
		KNOWN_NON_TERMINAL_EXECUTABLES.has(`${baseName}.exe`)
	);
}

/**
 * Checks if a window title contains a signature characteristic of a known non-terminal GUI application.
 */
export function isKnownNonTerminalTitle(title?: string | null): boolean {
	if (!title || typeof title !== 'string') {
		return false;
	}
	const clean = title.trim();
	if (!clean) return false;

	return KNOWN_NON_TERMINAL_TITLE_PATTERNS.some((pattern) =>
		pattern.test(clean),
	);
}

/**
 * Detects if a window title or application name corresponds to a command-line interface,
 * shell, or terminal (e.g. cmd.exe, PowerShell, Windows Terminal, bash, zsh, WSL, etc.)
 */
export function isTerminalOrConsoleTitle(title?: string | null): boolean {
	if (!title || typeof title !== 'string') {
		return false;
	}
	const clean = title.trim();
	if (!clean) return false;

	// Reject titles that exhibit known non-terminal GUI application signatures
	if (isKnownNonTerminalTitle(clean)) {
		return false;
	}

	return UNIVERSAL_TERMINAL_PATTERNS.some((pattern) => pattern.test(clean));
}

export interface TerminalSourceDescriptor {
	name?: string;
	executable?: string;
	windowClass?: string;
	appName?: string;
	id?: string;
}

/**
 * Unified multi-tier terminal detection evaluating executable, window class,
 * application name, and title / prompt heuristics.
 */
export function isTerminalOrConsoleSource(
	sourceInfo?: TerminalSourceDescriptor | null,
): boolean {
	if (!sourceInfo) return false;

	// Hard negative guard: if known non-terminal executable or app, immediately reject
	if (sourceInfo.executable && isNonTerminalExecutable(sourceInfo.executable)) {
		return false;
	}
	if (sourceInfo.appName && isNonTerminalExecutable(sourceInfo.appName)) {
		return false;
	}

	// Tier 1: Executable check
	if (sourceInfo.executable && isTerminalExecutable(sourceInfo.executable)) {
		return true;
	}

	// Tier 2: Window class check
	if (sourceInfo.windowClass && isTerminalWindowClass(sourceInfo.windowClass)) {
		return true;
	}

	// Tier 3: App name check
	if (sourceInfo.appName) {
		if (
			isTerminalExecutable(sourceInfo.appName) ||
			isTerminalOrConsoleTitle(sourceInfo.appName)
		) {
			return true;
		}
	}

	// Hard negative guard: if window title belongs to a known non-terminal application, reject
	if (sourceInfo.name && isKnownNonTerminalTitle(sourceInfo.name)) {
		return false;
	}

	// Tier 4: Window title / prompt check
	if (sourceInfo.name && isTerminalOrConsoleTitle(sourceInfo.name)) {
		return true;
	}

	return false;
}

export default isTerminalOrConsoleTitle;
