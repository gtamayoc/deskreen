import { execFile } from 'node:child_process';
import dgram from 'node:dgram';
import os from 'node:os';
import { promisify } from 'node:util';
import type { BrowserWindow } from 'electron';

const execFileAsync = promisify(execFile);

export function getLocalIpV4(): string {
	const ifaces = os.networkInterfaces();
	for (const name of Object.keys(ifaces)) {
		const list = ifaces[name];
		if (!list) continue;
		for (const iface of list) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
	return '127.0.0.1';
}

export type DevicePlatform =
	| 'android'
	| 'apple'
	| 'windows'
	| 'linux'
	| 'generic';

export type DeviceStatus = 'online' | 'connected' | 'busy' | 'unreachable';

export interface DiscoveredDevice {
	id: string; // unique identifier (IP, MAC, or ADB serial)
	name: string; // friendly hostname or model name
	ip: string; // IPv4 address
	platform: DevicePlatform;
	status: DeviceStatus;
	lastSeen: number; // timestamp ms
	adbAvailable?: boolean;
	adbPort?: number;
	mac?: string;
	services?: string[];
	txtRecords?: Record<string, string>;
}

export interface DnsQuestion {
	name: string;
	type: number;
	class: number;
}

export interface DnsResourceRecord {
	name: string;
	type: number;
	class: number;
	ttl: number;
	rdlength: number;
	data: unknown;
}

export interface DnsPacket {
	id: number;
	flags: number;
	questions: DnsQuestion[];
	answers: DnsResourceRecord[];
	authorities: DnsResourceRecord[];
	additionals: DnsResourceRecord[];
}

export const MDNS_MULTICAST_IP = '224.0.0.251';
export const MDNS_PORT = 5353;

export const DEFAULT_QUERY_SERVICES = [
	'_googlecast._tcp.local',
	'_airplay._tcp.local',
	'_apple-mobdev2._tcp.local',
	'_adb._tcp.local',
	'_adb-tls._tcp.local',
	'_http._tcp.local',
];

const STALE_DEVICE_TIMEOUT_MS = 60000;
const PURGE_DEVICE_TIMEOUT_MS = 120000;
const PERIODIC_SCAN_INTERVAL_MS = 20000;
const TTL_SWEEP_INTERVAL_MS = 10000;
const IPC_NETWORK_DEVICES_UPDATED = 'network-devices-updated';

/**
 * Safely decodes a DNS domain name from a buffer with pointer compression support.
 */
export function readDnsName(
	buf: Buffer,
	offset: number,
	visitedOffsets = new Set<number>(),
): { name: string; bytesRead: number } {
	let curr = offset;
	let jumped = false;
	let totalBytesRead = 0;
	const labels: string[] = [];

	while (curr < buf.length) {
		const len = buf[curr];
		if (len === 0) {
			if (!jumped) {
				totalBytesRead = curr - offset + 1;
			}
			break;
		}

		// Pointer check: two most significant bits are set (0xc0)
		if ((len & 0xc0) === 0xc0) {
			if (curr + 1 >= buf.length) break;
			const pointerOffset = ((len & 0x3f) << 8) | buf[curr + 1];
			if (!jumped) {
				totalBytesRead = curr - offset + 2;
				jumped = true;
			}
			if (visitedOffsets.has(pointerOffset) || visitedOffsets.size > 20) {
				// Prevent cyclic pointer loops or excessively deep compression chains
				break;
			}
			visitedOffsets.add(pointerOffset);
			curr = pointerOffset;
			continue;
		}

		// Standard DNS label
		curr++;
		if (curr + len > buf.length) break;
		labels.push(buf.subarray(curr, curr + len).toString('utf8'));
		curr += len;
		if (!jumped) {
			totalBytesRead = curr - offset;
		}
	}

	return {
		name: labels.join('.'),
		bytesRead: jumped ? totalBytesRead : Math.max(1, curr - offset + 1),
	};
}

/**
 * Parses DNS TXT resource record data into key-value map.
 */
export function parseTxtRdata(rdata: Buffer): Record<string, string> {
	const result: Record<string, string> = {};
	let offset = 0;
	while (offset < rdata.length) {
		const strLen = rdata[offset];
		offset++;
		if (offset + strLen > rdata.length) break;
		const entry = rdata.subarray(offset, offset + strLen).toString('utf8');
		offset += strLen;
		const eqIdx = entry.indexOf('=');
		if (eqIdx !== -1) {
			const key = entry.slice(0, eqIdx).trim().toLowerCase();
			const val = entry.slice(eqIdx + 1).trim();
			if (key) {
				result[key] = val;
			}
		} else if (entry.length > 0) {
			result[entry.toLowerCase()] = 'true';
		}
	}
	return result;
}

/**
 * Parses DNS SRV record data.
 */
export function parseSrvRdata(
	rdata: Buffer,
	fullPacket: Buffer,
	rdataOffset: number,
): { priority: number; weight: number; port: number; target: string } {
	if (rdata.length < 6) {
		return { priority: 0, weight: 0, port: 0, target: '' };
	}
	const priority = rdata.readUInt16BE(0);
	const weight = rdata.readUInt16BE(2);
	const port = rdata.readUInt16BE(4);
	const { name: target } = readDnsName(fullPacket, rdataOffset + 6);
	return { priority, weight, port, target };
}

/**
 * Parses raw DNS buffer into structured DnsPacket.
 */
export function parseDnsPacket(buf: Buffer): DnsPacket | null {
	if (!buf || buf.length < 12) {
		return null;
	}

	try {
		const id = buf.readUInt16BE(0);
		const flags = buf.readUInt16BE(2);
		const qdcount = buf.readUInt16BE(4);
		const ancount = buf.readUInt16BE(6);
		const nscount = buf.readUInt16BE(8);
		const arcount = buf.readUInt16BE(10);

		let offset = 12;
		const questions: DnsQuestion[] = [];

		for (let i = 0; i < qdcount; i++) {
			if (offset >= buf.length) break;
			const { name, bytesRead } = readDnsName(buf, offset);
			offset += bytesRead;
			if (offset + 4 > buf.length) break;
			const type = buf.readUInt16BE(offset);
			const cls = buf.readUInt16BE(offset + 2);
			offset += 4;
			questions.push({ name, type, class: cls });
		}

		const readRecords = (count: number): DnsResourceRecord[] => {
			const records: DnsResourceRecord[] = [];
			for (let i = 0; i < count; i++) {
				if (offset >= buf.length) break;
				const { name, bytesRead } = readDnsName(buf, offset);
				offset += bytesRead;
				if (offset + 10 > buf.length) break;
				const type = buf.readUInt16BE(offset);
				const cls = buf.readUInt16BE(offset + 2);
				const ttl = buf.readUInt32BE(offset + 4);
				const rdlength = buf.readUInt16BE(offset + 8);
				offset += 10;
				if (offset + rdlength > buf.length) break;

				const rdata = buf.subarray(offset, offset + rdlength);
				let parsedData: unknown = rdata;

				if (type === 1 && rdlength === 4) {
					// Type A (IPv4)
					parsedData = `${rdata[0]}.${rdata[1]}.${rdata[2]}.${rdata[3]}`;
				} else if (type === 12) {
					// Type PTR
					const ptrName = readDnsName(buf, offset);
					parsedData = ptrName.name;
				} else if (type === 16) {
					// Type TXT
					parsedData = parseTxtRdata(rdata);
				} else if (type === 33) {
					// Type SRV
					parsedData = parseSrvRdata(rdata, buf, offset);
				}

				records.push({
					name,
					type,
					class: cls,
					ttl,
					rdlength,
					data: parsedData,
				});

				offset += rdlength;
			}
			return records;
		};

		const answers = readRecords(ancount);
		const authorities = readRecords(nscount);
		const additionals = readRecords(arcount);

		return {
			id,
			flags,
			questions,
			answers,
			authorities,
			additionals,
		};
	} catch (_err) {
		return null;
	}
}

/**
 * Encodes a DNS-SD query packet for requested services.
 */
export function encodeDnsQuery(services: string[], txId = 0): Buffer {
	const header = Buffer.alloc(12);
	header.writeUInt16BE(txId, 0);
	header.writeUInt16BE(0x0000, 2); // standard query
	header.writeUInt16BE(services.length, 4); // QDCOUNT
	header.writeUInt16BE(0, 6); // ANCOUNT
	header.writeUInt16BE(0, 8); // NSCOUNT
	header.writeUInt16BE(0, 10); // ARCOUNT

	const parts: Buffer[] = [header];

	for (const service of services) {
		const labels = service.split('.').filter(Boolean);
		for (const label of labels) {
			const labelBuf = Buffer.from(label, 'utf8');
			parts.push(Buffer.from([labelBuf.length]), labelBuf);
		}
		parts.push(Buffer.from([0x00])); // null terminator
		const qMeta = Buffer.alloc(4);
		qMeta.writeUInt16BE(12, 0); // PTR type (12)
		qMeta.writeUInt16BE(1, 2); // Class IN (1)
		parts.push(qMeta);
	}

	return Buffer.concat(parts);
}

/**
 * Classifies a discovered device platform based on mDNS service types,
 * TXT records, hostname, and metadata heuristics.
 */
export function classifyPlatform(info: {
	services?: string[];
	name?: string;
	hostname?: string;
	txt?: Record<string, string>;
	mac?: string;
}): DevicePlatform {
	const services = (info.services || []).join(' ').toLowerCase();
	const name = (info.name || '').toLowerCase();
	const hostname = (info.hostname || '').toLowerCase();
	const txtStr = info.txt ? JSON.stringify(info.txt).toLowerCase() : '';
	const combined = `${services} ${name} ${hostname} ${txtStr}`;

	// 1. Android / Google Cast heuristics
	if (
		services.includes('_googlecast') ||
		services.includes('_adb') ||
		combined.includes('googlecast') ||
		combined.includes('chromecast') ||
		combined.includes('android') ||
		combined.includes('pixel') ||
		combined.includes('galaxy') ||
		combined.includes('xiaomi') ||
		combined.includes('redmi') ||
		combined.includes('oneplus') ||
		combined.includes('huawei') ||
		combined.includes('motorola') ||
		combined.includes('oppo') ||
		combined.includes('realme') ||
		combined.includes('vivo') ||
		(info.txt &&
			(info.txt['md']?.toLowerCase().includes('cast') ||
				info.txt['fn']?.toLowerCase().includes('google') ||
				Boolean(info.txt['ca'])))
	) {
		return 'android';
	}

	// 2. Apple / iOS / macOS heuristics
	if (
		services.includes('_airplay') ||
		services.includes('_apple-mobdev') ||
		services.includes('_raop') ||
		combined.includes('iphone') ||
		combined.includes('ipad') ||
		combined.includes('ipod') ||
		combined.includes('apple') ||
		combined.includes('macbook') ||
		combined.includes('imac') ||
		combined.includes('darwin') ||
		combined.includes('airplay') ||
		(info.txt &&
			(info.txt['model']?.toLowerCase().includes('apple') ||
				info.txt['model']?.toLowerCase().includes('iphone') ||
				info.txt['model']?.toLowerCase().includes('ipad') ||
				Boolean(info.txt['deviceid']) ||
				Boolean(info.txt['acl'])))
	) {
		return 'apple';
	}

	// 3. Linux heuristics
	if (
		combined.includes('linux') ||
		combined.includes('ubuntu') ||
		combined.includes('debian') ||
		combined.includes('fedora') ||
		combined.includes('arch') ||
		combined.includes('raspberry') ||
		combined.includes('raspbian')
	) {
		return 'linux';
	}

	// 4. Windows heuristics
	if (
		hostname.startsWith('desktop-') ||
		hostname.startsWith('laptop-') ||
		hostname.startsWith('win-') ||
		combined.includes('windows') ||
		combined.includes('msft') ||
		combined.includes('surface')
	) {
		return 'windows';
	}

	return 'generic';
}

/**
 * Parses output of `arp -a` across Windows and Unix platforms safely.
 */
export function parseArpOutput(
	stdout: string,
	localIp?: string,
): Array<{ ip: string; mac?: string }> {
	const lines = stdout.split('\n');
	const results: Array<{ ip: string; mac?: string }> = [];
	const seenIps = new Set<string>();

	const ipRegex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/;
	const macRegex =
		/([0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2})/;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;

		// Filter out interface header lines (e.g. "Interface: 192.168.1.100 --- 0x14" or "Interfaz: 192.168.137.1 --- 0x8")
		if (/^(interface|interfaz)\b/i.test(line)) continue;

		const ipMatch = ipRegex.exec(line);
		if (!ipMatch) continue;

		const ip = ipMatch[1];
		if (seenIps.has(ip)) continue;

		// Filter out broadcast, multicast, loopback, and local host IP
		if (
			ip === '255.255.255.255' ||
			ip.endsWith('.255') ||
			ip.startsWith('224.') ||
			ip.startsWith('239.') ||
			ip.startsWith('127.') ||
			ip === '0.0.0.0' ||
			(localIp && ip === localIp)
		) {
			continue;
		}

		// Ensure valid octets
		const octets = ip.split('.').map((p) => Number.parseInt(p, 10));
		if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
			continue;
		}

		// Require a valid MAC address
		const macMatch = macRegex.exec(line);
		if (!macMatch) continue;

		// Normalize MAC (e.g. 0:11:22:33:44:55 -> 00:11:22:33:44:55)
		const mac = macMatch[1]
			.split(/[:-]/)
			.map((part) => part.padStart(2, '0'))
			.join(':')
			.toLowerCase();

		if (mac === 'ff:ff:ff:ff:ff:ff' || mac === '00:00:00:00:00:00') continue;

		seenIps.add(ip);
		results.push({ ip, mac });
	}

	return results;
}

export class NetworkDiscoveryService {
	private socket: dgram.Socket | null = null;
	private isRunning = false;
	private mainWindow: BrowserWindow | null = null;
	private devices = new Map<string, DiscoveredDevice>();
	private scanTimer: NodeJS.Timeout | null = null;
	private sweepTimer: NodeJS.Timeout | null = null;
	private updateListeners: Array<(devices: DiscoveredDevice[]) => void> = [];

	setMainWindow(window: BrowserWindow | null): void {
		this.mainWindow = window;
	}

	onDevicesUpdated(
		listener: (devices: DiscoveredDevice[]) => void,
	): () => void {
		this.updateListeners.push(listener);
		return () => {
			this.updateListeners = this.updateListeners.filter((l) => l !== listener);
		};
	}

	start(): void {
		if (this.isRunning || this.socket) return;

		try {
			this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

			this.socket.on('error', (err) => {
				console.warn(
					'[NetworkDiscoveryService] UDP socket error:',
					err.message,
				);
			});

			this.socket.on('message', (msg, rinfo) => {
				this.handleSocketMessage(msg, rinfo);
			});

			this.socket.bind(MDNS_PORT, '0.0.0.0', () => {
				try {
					this.socket?.addMembership(MDNS_MULTICAST_IP);
					this.socket?.setMulticastTTL(255);
					this.socket?.setMulticastLoopback(true);
					this.isRunning = true;
					console.log(
						`[NetworkDiscoveryService] Active discovery listening on ${MDNS_MULTICAST_IP}:${MDNS_PORT}`,
					);
					void this.scanNow();
				} catch (membershipErr) {
					console.warn(
						'[NetworkDiscoveryService] Multicast membership error:',
						membershipErr,
					);
				}
			});

			// Setup periodic active probing
			this.scanTimer = setInterval(() => {
				void this.scanNow();
			}, PERIODIC_SCAN_INTERVAL_MS);
			this.scanTimer.unref?.();

			// Setup periodic TTL cleanup sweep
			this.sweepTimer = setInterval(() => {
				this.sweepStaleDevices();
			}, TTL_SWEEP_INTERVAL_MS);
			this.sweepTimer.unref?.();
		} catch (err) {
			console.warn('[NetworkDiscoveryService] Failed to start discovery:', err);
		}
	}

	stop(): void {
		if (this.scanTimer) {
			clearInterval(this.scanTimer);
			this.scanTimer = null;
		}
		if (this.sweepTimer) {
			clearInterval(this.sweepTimer);
			this.sweepTimer = null;
		}
		if (this.socket) {
			try {
				this.socket.close();
			} catch {
				// ignore
			}
			this.socket = null;
		}
		this.isRunning = false;
	}

	async scanNow(): Promise<DiscoveredDevice[]> {
		this.sendMdnsQuery();
		await this.inspectArpTable();
		this.sweepStaleDevices();
		return this.getDiscoveredDevices();
	}

	getDiscoveredDevices(): DiscoveredDevice[] {
		return Array.from(this.devices.values()).sort((a, b) => {
			if (a.status === 'online' && b.status !== 'online') return -1;
			if (a.status !== 'online' && b.status === 'online') return 1;
			return b.lastSeen - a.lastSeen;
		});
	}

	private sendMdnsQuery(): void {
		if (!this.socket) return;
		try {
			const queryPacket = encodeDnsQuery(DEFAULT_QUERY_SERVICES);
			this.socket.send(
				queryPacket,
				0,
				queryPacket.length,
				MDNS_PORT,
				MDNS_MULTICAST_IP,
				(err) => {
					if (err) {
						console.warn(
							'[NetworkDiscoveryService] Error sending query:',
							err.message,
						);
					}
				},
			);
		} catch (err) {
			console.warn('[NetworkDiscoveryService] Query construction error:', err);
		}
	}

	public handleSocketMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		try {
			const packet = parseDnsPacket(msg);
			if (!packet) return;

			const senderIp = rinfo.address;
			const localIp = getLocalIpV4();
			if (senderIp === localIp || senderIp === '127.0.0.1') {
				return;
			}

			let deviceName = '';
			let targetIp = senderIp;
			let adbPort: number | undefined;
			let adbAvailable = false;
			const discoveredServices: string[] = [];
			let txtMap: Record<string, string> = {};

			const allRecords = [
				...packet.answers,
				...packet.authorities,
				...packet.additionals,
			];

			for (const record of allRecords) {
				if (record.type === 1 && typeof record.data === 'string') {
					// A record
					targetIp = record.data;
				} else if (record.type === 12 && typeof record.data === 'string') {
					// PTR record
					const ptr = record.data;
					discoveredServices.push(record.name);
					const parts = ptr.split('.');
					if (parts.length > 0 && !deviceName) {
						deviceName = parts[0];
					}
				} else if (
					record.type === 16 &&
					typeof record.data === 'object' &&
					record.data
				) {
					// TXT record
					txtMap = { ...txtMap, ...(record.data as Record<string, string>) };
					if (txtMap['fn'] && !deviceName) {
						deviceName = txtMap['fn'];
					} else if (txtMap['md'] && !deviceName) {
						deviceName = txtMap['md'];
					}
				} else if (
					record.type === 33 &&
					typeof record.data === 'object' &&
					record.data
				) {
					// SRV record
					const srv = record.data as { port: number; target: string };
					if (record.name.includes('_adb')) {
						adbPort = srv.port;
						adbAvailable = true;
					}
					if (!deviceName && srv.target) {
						deviceName = srv.target.replace(/\.local\.?$/, '');
					}
				}
			}

			// Don't register own local machine
			if (targetIp === localIp || targetIp === '127.0.0.1') {
				return;
			}

			// If no friendly name parsed, default to Device (IP)
			if (!deviceName) {
				deviceName = `Device (${targetIp})`;
			}

			const platform = classifyPlatform({
				services: discoveredServices,
				name: deviceName,
				txt: txtMap,
			});

			this.addOrUpdateDevice({
				id: targetIp,
				name: deviceName,
				ip: targetIp,
				platform,
				status: 'online',
				lastSeen: Date.now(),
				adbAvailable: adbAvailable || undefined,
				adbPort: adbPort || undefined,
				services:
					discoveredServices.length > 0 ? discoveredServices : undefined,
				txtRecords: Object.keys(txtMap).length > 0 ? txtMap : undefined,
			});
		} catch (err) {
			console.warn('[NetworkDiscoveryService] Socket message error:', err);
		}
	}

	public async inspectArpTable(): Promise<void> {
		try {
			const { stdout } = await execFileAsync('arp', ['-a'], {
				timeout: 4000,
			});
			const localIp = getLocalIpV4();
			const entries = parseArpOutput(stdout, localIp);

			for (const entry of entries) {
				const existing = this.devices.get(entry.ip);
				if (existing) {
					existing.lastSeen = Date.now();
					if (existing.status === 'unreachable') {
						existing.status = 'online';
					}
					if (entry.mac && !existing.mac) {
						existing.mac = entry.mac;
					}
				} else {
					this.addOrUpdateDevice({
						id: entry.ip,
						name: `Device (${entry.ip})`,
						ip: entry.ip,
						platform: 'generic',
						status: 'online',
						lastSeen: Date.now(),
						mac: entry.mac,
					});
				}
			}
		} catch (err) {
			// Non-fatal if arp fails
			console.warn('[NetworkDiscoveryService] ARP table query error:', err);
		}
	}

	public addOrUpdateDevice(dev: DiscoveredDevice): void {
		const existing = this.devices.get(dev.ip);
		if (!existing) {
			this.devices.set(dev.ip, dev);
			this.emitUpdate();
			return;
		}

		let changed = false;

		// Upgrade platform if newly detected is more specific than generic
		if (existing.platform === 'generic' && dev.platform !== 'generic') {
			existing.platform = dev.platform;
			changed = true;
		}

		// Upgrade generic default name
		if (
			(!existing.name || existing.name.startsWith('Device (')) &&
			dev.name &&
			!dev.name.startsWith('Device (')
		) {
			existing.name = dev.name;
			changed = true;
		}

		if (dev.status && existing.status !== dev.status) {
			existing.status = dev.status;
			changed = true;
		}

		if (dev.adbAvailable && !existing.adbAvailable) {
			existing.adbAvailable = true;
			existing.adbPort = dev.adbPort || 5555;
			changed = true;
		}

		if (dev.mac && !existing.mac) {
			existing.mac = dev.mac;
			changed = true;
		}

		if (dev.services) {
			const currentServices = new Set(existing.services || []);
			for (const s of dev.services) {
				currentServices.add(s);
			}
			existing.services = Array.from(currentServices);
		}

		if (dev.txtRecords) {
			existing.txtRecords = { ...existing.txtRecords, ...dev.txtRecords };
		}

		existing.lastSeen = dev.lastSeen;

		if (changed) {
			this.emitUpdate();
		}
	}

	public sweepStaleDevices(): void {
		const now = Date.now();
		let changed = false;

		for (const [ip, dev] of this.devices.entries()) {
			const elapsed = now - dev.lastSeen;
			if (elapsed > PURGE_DEVICE_TIMEOUT_MS) {
				this.devices.delete(ip);
				changed = true;
			} else if (elapsed > STALE_DEVICE_TIMEOUT_MS && dev.status === 'online') {
				dev.status = 'unreachable';
				changed = true;
			}
		}

		if (changed) {
			this.emitUpdate();
		}
	}

	private emitUpdate(): void {
		const devices = this.getDiscoveredDevices();
		for (const listener of this.updateListeners) {
			try {
				listener(devices);
			} catch (err) {
				console.warn('[NetworkDiscoveryService] Listener error:', err);
			}
		}

		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			try {
				this.mainWindow.webContents.send(IPC_NETWORK_DEVICES_UPDATED, devices);
			} catch (err) {
				console.warn('[NetworkDiscoveryService] IPC emit error:', err);
			}
		}
	}
}

export const networkDiscoveryService = new NetworkDiscoveryService();
