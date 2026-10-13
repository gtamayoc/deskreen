import dgram from 'node:dgram';
import getMyLocalIpV4 from '../helpers/getMyLocalIpV4';

const MDNS_MULTICAST_IP = '224.0.0.251';
const MDNS_PORT = 5353;
const TARGET_HOST = 'deskreen.local';

export class MDNSResponderService {
	private socket: dgram.Socket | null = null;
	private isRunning = false;

	start(): void {
		if (this.isRunning) return;

		try {
			this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

			this.socket.on('error', (err) => {
				console.warn('[mDNS Service] Socket error caught safely:', err.message);
				this.stop();
			});

			this.socket.on('message', (msg, rinfo) => {
				try {
					this.handleMessage(msg, rinfo);
				} catch (_msgErr) {
					// safe catch for malformed packets
				}
			});

			this.socket.bind(MDNS_PORT, '0.0.0.0', () => {
				try {
					this.socket?.addMembership(MDNS_MULTICAST_IP);
					this.isRunning = true;
					console.log(
						`[mDNS Service] Listening on ${MDNS_MULTICAST_IP}:${MDNS_PORT} for ${TARGET_HOST}`,
					);
				} catch (membershipErr) {
					console.warn(
						'[mDNS Service] Could not add multicast membership:',
						membershipErr,
					);
				}
			});
		} catch (error) {
			console.warn('[mDNS Service] Failed to initialize mDNS socket:', error);
		}
	}

	stop(): void {
		if (this.socket) {
			try {
				this.socket.close();
			} catch {
				// ignore close errors
			}
			this.socket = null;
		}
		this.isRunning = false;
	}

	private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		const str = msg.toString('latin1').toLowerCase();
		if (!str.includes('deskreen') || !str.includes('local')) {
			return;
		}

		const ip = getMyLocalIpV4();
		if (!ip) return;

		const ipParts = ip.split('.').map((p) => Number.parseInt(p, 10));
		if (ipParts.length !== 4 || ipParts.some((n) => Number.isNaN(n))) {
			return;
		}

		// Transaction ID from incoming query
		const txId = msg.subarray(0, 2);

		// DNS response packet header
		// Flags: 0x8400 (Response, Authoritative Answer)
		// Questions: 0, Answers: 1, Authority: 0, Additional: 0
		const header = Buffer.from([
			txId[0],
			txId[1],
			0x84,
			0x00,
			0x00,
			0x00,
			0x00,
			0x01,
			0x00,
			0x00,
			0x00,
			0x00,
		]);

		// Name: \x08deskreen\x05local\x00
		const name = Buffer.from([
			0x08,
			0x64,
			0x65,
			0x73,
			0x6b,
			0x72,
			0x65,
			0x65,
			0x6e, // 8deskreen
			0x05,
			0x6c,
			0x6f,
			0x63,
			0x61,
			0x6c, // 5local
			0x00, // end of name
		]);

		// Type: A (1), Class: IN (1) with cache-flush bit (0x8001), TTL: 120s (0x00000078), Data length: 4 (0x0004)
		const answerMeta = Buffer.from([
			0x00,
			0x01, // Type A
			0x80,
			0x01, // Class IN, cache flush
			0x00,
			0x00,
			0x00,
			0x78, // TTL 120s
			0x00,
			0x04, // Data len 4
		]);

		const ipData = Buffer.from(ipParts);

		const responsePacket = Buffer.concat([header, name, answerMeta, ipData]);

		// Send back to querier or multicast
		this.socket?.send(
			responsePacket,
			0,
			responsePacket.length,
			rinfo.port,
			rinfo.address,
			(err) => {
				if (err) {
					console.warn('[mDNS Service] Send error:', err.message);
				}
			},
		);
	}
}

export const mdnsResponderService = new MDNSResponderService();
