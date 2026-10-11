import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import axios from 'axios';
import { app } from 'electron';

const execFileAsync = promisify(execFile);

export class AdbDownloaderService {
	private isDownloading = false;

	getInternalPlatformToolsDir(): string {
		return path.join(app.getPath('userData'), 'bin', 'platform-tools');
	}

	getInternalAdbBinaryPath(): string {
		const ext = process.platform === 'win32' ? '.exe' : '';
		return path.join(this.getInternalPlatformToolsDir(), `adb${ext}`);
	}

	isInternalAdbInstalled(): boolean {
		try {
			const binPath = this.getInternalAdbBinaryPath();
			return fs.existsSync(binPath);
		} catch {
			return false;
		}
	}

	private getDownloadUrl(): string {
		switch (process.platform) {
			case 'win32':
				return 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';
			case 'darwin':
				return 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip';
			case 'linux':
				return 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip';
			default:
				throw new Error(`Unsupported platform: ${process.platform}`);
		}
	}

	async downloadAndInstall(
		onProgress?: (progress: number) => void,
	): Promise<string> {
		if (this.isDownloading) {
			throw new Error('Download already in progress');
		}

		this.isDownloading = true;
		const downloadUrl = this.getDownloadUrl();
		const binDir = path.join(app.getPath('userData'), 'bin');
		const tempZipPath = path.join(app.getPath('temp'), `platform-tools-${Date.now()}.zip`);

		try {
			if (!fs.existsSync(binDir)) {
				fs.mkdirSync(binDir, { recursive: true });
			}

			// Download zip using axios stream
			const response = await axios({
				method: 'get',
				url: downloadUrl,
				responseType: 'stream',
			});

			const totalBytes = Number(response.headers['content-length']) || 0;
			let downloadedBytes = 0;

			const writer = fs.createWriteStream(tempZipPath);

			response.data.on('data', (chunk: Buffer) => {
				downloadedBytes += chunk.length;
				if (totalBytes > 0 && onProgress) {
					onProgress(Math.round((downloadedBytes / totalBytes) * 100));
				}
			});

			await new Promise<void>((resolve, reject) => {
				response.data.pipe(writer);
				writer.on('finish', () => resolve());
				writer.on('error', (err) => reject(err));
			});

			// Extract using native tar command (available on Win10+, macOS, Linux)
			await execFileAsync('tar', ['-xf', tempZipPath, '-C', binDir]);

			const adbPath = this.getInternalAdbBinaryPath();
			if (!fs.existsSync(adbPath)) {
				throw new Error(`Failed to locate adb binary at ${adbPath}`);
			}

			// Ensure execution permission on Unix
			if (process.platform !== 'win32') {
				try {
					fs.chmodSync(adbPath, 0o755);
				} catch (chmodErr) {
					console.warn('Failed to chmod adb binary:', chmodErr);
				}
			}

			return adbPath;
		} finally {
			this.isDownloading = false;
			// Clean up temp zip
			try {
				if (fs.existsSync(tempZipPath)) {
					fs.unlinkSync(tempZipPath);
				}
			} catch {
				// ignore cleanup error
			}
		}
	}
}

export const adbDownloaderService = new AdbDownloaderService();
