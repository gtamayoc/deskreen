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

	// Regular expressions targeting cmd, powershell, windows terminal, git bash, wsl, etc.
	const terminalPatterns: RegExp[] = [
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

		// Shells
		/\b(bash|zsh|fish|sh|wsl)(\.exe)?\b/i,

		// CLI orchestration / agent runners
		/\bralph(-tui)?\b/i,
		/\bclaude\b/i,
		/\bipython\b/i,
	];

	return terminalPatterns.some((pattern) => pattern.test(clean));
}

export default isTerminalOrConsoleTitle;
