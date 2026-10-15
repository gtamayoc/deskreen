/*
 * original JS code from darkwire.io
 * translated to typescript for Deskreen app
 * by Pavlo (Paul) Buidenkov
 * */

import http from 'http';
import Koa from 'koa';
import crypto from 'crypto';
import { Server } from 'socket.io';
import cors from './corsMiddleware';
import koaStatic from 'koa-static';
import koaSend from 'koa-send';
import detectPort from 'detect-port';
import config from '../common/config';
import startPollForInactiveRooms from './startPollForInactiveRooms';
import Logger from '../main/utils/LoggerWithFilePrefix';
import SocketsIPService from './socketsIPService';
import socketIOServerStore from './store/socketIOServerStore';
import DarkwireSocket from './darkwireSocket';
import getStore from './store';
import { getDeskreenGlobal } from '../main/helpers/getDeskreenGlobal';
import getMyLocalIpV4 from '../main/helpers/getMyLocalIpV4';
import { getClientViewerDistPath } from './getClientViewerDistPath';
import { store } from '../common/deskreen-electron-store';
import SharingSessionStatusEnum from '../features/SharingSessionService/SharingSessionStatusEnum';

const { hostname, primaryPort, backupPort } = config;

const getRoomIdHash = (id: string): string => {
	return crypto.createHash('sha256').update(id).digest('hex');
};

export const isRoomActiveOrWaiting = (roomIdStr: string): boolean => {
	const deskreenGlobal = getDeskreenGlobal();
	if (!roomIdStr) return false;
	if (deskreenGlobal.roomIDService.isRoomIDTaken(roomIdStr)) {
		return true;
	}
	if (
		deskreenGlobal.sharingSessionService.waitingForConnectionSharingSession
			?.roomID === roomIdStr
	) {
		return true;
	}
	for (const session of deskreenGlobal.sharingSessionService.sharingSessions.values()) {
		if (session.roomID === roomIdStr) {
			return true;
		}
	}
	return false;
};

const ioHandleOnConnection = (socket): void => {
	let { roomId } = socket.handshake.query;
	const store = getStore();

	(async () => {
		const deskreenGlobal = getDeskreenGlobal();
		let waitingSession =
			deskreenGlobal.sharingSessionService.waitingForConnectionSharingSession;
		const isHelper = socket.handshake.query?.isHelper === 'true';

		// If no waiting session is present but device slots are available, dynamically provision one
		if (
			!waitingSession &&
			!isHelper &&
			deskreenGlobal.connectedDevicesService?.isSlotAvailable()
		) {
			try {
				waitingSession =
					await deskreenGlobal.sharingSessionService.createWaitingForConnectionSharingSession();
			} catch {
				// ignore
			}
		}

		if ((!roomId || !isRoomActiveOrWaiting(String(roomId))) && waitingSession) {
			roomId = waitingSession.roomID;
		}

		if (!roomId || !isRoomActiveOrWaiting(String(roomId))) {
			socket.emit('NOT_ALLOWED');
			setTimeout(() => {
				socket.disconnect(true);
			}, 1000);
			return;
		}
		let finalRoomId = String(roomId);
		let roomIdHash = getRoomIdHash(finalRoomId);

		let storedRoom = await store.get('rooms', roomIdHash);
		let parsedRoom =
			typeof storedRoom === 'string' ? JSON.parse(storedRoom) : {};

		let usersInRoom = (parsedRoom as Room)?.users || [];

		// If this is a viewer socket and this room is ALREADY occupied by another viewer:
		// Route the viewer to the available waiting room instead of collision!
		const viewersInRoom = usersInRoom.filter((u) => !u.isOwner);
		if (!isHelper && viewersInRoom.length >= 1) {
			if (
				(!waitingSession ||
					!waitingSession.roomID ||
					waitingSession.roomID === finalRoomId) &&
				deskreenGlobal.connectedDevicesService?.isSlotAvailable()
			) {
				try {
					waitingSession =
						await deskreenGlobal.sharingSessionService.createWaitingForConnectionSharingSession();
				} catch {
					// ignore
				}
			}

			if (
				waitingSession &&
				waitingSession.roomID &&
				waitingSession.roomID !== finalRoomId
			) {
				console.log(
					`[SignalingServer] Room ${finalRoomId} already occupied by a viewer. Routing incoming viewer to available waiting room ${waitingSession.roomID}`,
				);
				finalRoomId = waitingSession.roomID;
				roomIdHash = getRoomIdHash(finalRoomId);
				storedRoom = await store.get('rooms', roomIdHash);
				parsedRoom =
					typeof storedRoom === 'string' ? JSON.parse(storedRoom) : {};
				usersInRoom = (parsedRoom as Room)?.users || [];
			}
		}

		if ((parsedRoom as Room)?.isLocked && usersInRoom.length <= 1) {
			(parsedRoom as Room).isLocked = false;
			await store.set('rooms', roomIdHash, JSON.stringify(parsedRoom));
		}

		new DarkwireSocket({
			roomIdOriginal: finalRoomId,
			roomId: roomIdHash,
			socket,
			room: parsedRoom as Room,
		});
	})();
};

function setStaticFileHeaders(
	ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>,
): void {
	ctx.set({
		'strict-transport-security': 'max-age=31536000',
		'X-Frame-Options': 'deny',
		'X-XSS-Protection': '1; mode=block',
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'no-referrer',
		'Feature-Policy':
			"geolocation 'none'; vr 'none'; payment 'none'; microphone 'none'",
		// 'Cache-Control': 'max-age=0', // make browser get fresh files and make new connection when client connected
	});
}

class DeskreenSignalingServer {
	log = new Logger(__filename);

	server = {} as unknown as http.Server;

	hostname: string;

	primaryPort: number;

	backupPort: number;

	port: number;

	app: Koa | undefined;

	clientDistDirectory: string;

	constructor() {
		const localIp = getMyLocalIpV4();
		this.hostname = localIp || String(hostname);
		const customPortStr = store.get('custom_server_port');
		const customPort = customPortStr ? parseInt(customPortStr, 10) : Number.NaN;
		this.primaryPort =
			!Number.isNaN(customPort) && customPort >= 1024 && customPort <= 65535
				? customPort
				: parseInt(primaryPort as unknown as string, 10);
		this.backupPort = parseInt(backupPort as unknown as string, 10);

		this.port = this.primaryPort;
		this.clientDistDirectory = getClientViewerDistPath();

		if (!this.clientDistDirectory) {
			this.log.error(
				'Client viewer bundle is missing. Remote connections will fail.',
			);
		}

		this.init();
	}

	init(): void {
		this.app = new Koa();

		this.app.use(cors());
		this.app.use(async (ctx, next) => {
			if (ctx.path === '/ping' && ctx.method === 'GET') {
				ctx.body = 'pong';
				return;
			}
			await next();
		});

		const clientDistDirectory = this.clientDistDirectory;

		if (clientDistDirectory) {
			this.app.use(async (ctx, next) => {
				if (ctx.path === '/' || ctx.path === '') {
					const waitingSession =
						getDeskreenGlobal().sharingSessionService
							.waitingForConnectionSharingSession;
					if (waitingSession && waitingSession.roomID) {
						ctx.redirect(`/${waitingSession.roomID}`);
						return;
					}
					const activeSessions = Array.from(
						getDeskreenGlobal().sharingSessionService.sharingSessions.values(),
					);
					if (activeSessions.length > 0 && activeSessions[0].roomID) {
						ctx.redirect(`/${activeSessions[0].roomID}`);
						return;
					}
				} else {
					const cleanPath = ctx.path.replace(/^\//, '').split('?')[0];
					if (cleanPath) {
						const deskreenGlobal = getDeskreenGlobal();
						const waitingSession =
							deskreenGlobal.sharingSessionService
								?.waitingForConnectionSharingSession;
						const activeSessions = Array.from(
							deskreenGlobal.sharingSessionService?.sharingSessions?.values() ||
								[],
						);
						const isPathOccupied = activeSessions.some(
							(s) =>
								s.roomID === cleanPath &&
								s.status === SharingSessionStatusEnum.SHARING,
						);
						if (
							isPathOccupied &&
							waitingSession &&
							waitingSession.roomID &&
							waitingSession.roomID !== cleanPath
						) {
							console.log(
								`[Server] Path /${cleanPath} already in active sharing. Redirecting HTTP request to waiting room /${waitingSession.roomID}`,
							);
							ctx.redirect(`/${waitingSession.roomID}`);
							return;
						}
					}
				}
				setStaticFileHeaders(ctx);
				await koaStatic(clientDistDirectory)(ctx, next);
			});

			this.app.use(async (ctx) => {
				setStaticFileHeaders(ctx);
				await koaSend(ctx, 'index.html', { root: clientDistDirectory });
			});
		} else {
			this.app.use(async (ctx) => {
				ctx.body = { ready: true };
			});
		}

		const protocol = http;

		this.server = protocol.createServer(this.app.callback());
		const io = new Server(this.server, {
			pingInterval: 20000,
			pingTimeout: 5000,
			serveClient: false,
			cors: {
				origin: (_origin, callback) => {
					callback(null, true);
				},
				methods: ['GET', 'POST'],
				credentials: true,
			},
		});

		io.sockets.on('connection', (socket) => {
			const socketId = socket.id;

			const clientIp = socket.request.socket.remoteAddress;
			SocketsIPService.setIPOfSocketID(socketId, clientIp || '');
		});

		io.on('connection', (socket) => {
			ioHandleOnConnection(socket);
		});

		socketIOServerStore.setServer(io);
	}

	async start(): Promise<http.Server> {
		startPollForInactiveRooms();
		this.server = await this.callListenOnHttpServer();
		return this.server;
	}

	listenCallback() {
		return () => {
			this.log.info(
				`Deskreen CE signaling server is online at port ${this.port}`,
			);
			this.log.info(
				`🌐 Server available at http://${this.hostname}:${this.port}`,
			);
		};
	}

	async callListenOnHttpServer(): Promise<http.Server> {
		return new Promise<http.Server>((resolve, reject) => {
			const tryListen = (port: number): void => {
				// Remove any previous error listeners
				this.server.removeAllListeners('error');

				// Set up error handler
				this.server.once('error', async (error: NodeJS.ErrnoException) => {
					if (
						error.code === 'EADDRINUSE' &&
						(port === this.primaryPort || port === this.backupPort)
					) {
						// Primary port is already in use, try backup
						this.log.error(`Port ${port} is already in use`);
						this.log.warn(
							`Port ${primaryPort} is in use. Trying backup port ${backupPort}...`,
						);

						try {
							const detectedBackupPort = await detectPort(backupPort);

							if (backupPort === detectedBackupPort) {
								this.log.info(`Backup port ${backupPort} is available.`);
								this.port = backupPort;
								tryListen(backupPort);
							} else {
								const errorMsg = `Both primary port ${primaryPort} and backup port ${backupPort} are in use`;
								this.log.error(`Error: ${errorMsg}`);
								// reject(new Error(errorMsg));
								this.port = await detectPort();
								tryListen(this.port);
							}
						} catch (err) {
							this.log.error(
								'An unexpected error occurred while detecting ports:',
								err,
							);
							reject(err);
						}
					} else {
						// Some other error or backup port is also in use
						this.log.error(`Failed to start server on port ${port}:`, error);
						reject(error);
					}
				});

				// Attempt to listen on all interfaces (0.0.0.0) to allow both local and local network access
				this.server.listen(port, '0.0.0.0', () => {
					this.listenCallback()();
					resolve(this.server);
				});
			};

			// Start with the primary port
			tryListen(this.port);
		});
	}

	stop(): void {
		this.server.close();
	}
}

export const signalingServer = new DeskreenSignalingServer();
