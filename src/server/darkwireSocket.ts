/*
 * original JS code from darkwire.io
 * translated and adapted to typescript for Deskreen CE app
 * */

/* eslint-disable no-async-promise-executor */
import _ from 'lodash';
import Io from 'socket.io';
import socketsIPService from './socketsIPService';
import getStore from './store';
import socketIOServerStore from './store/socketIOServerStore';

const LOCALHOST_SOCKET_IP = '127.0.0.1';

interface SocketOPTS {
	roomId: string;
	socket: Io.Socket;
	room: Room;
	roomIdOriginal: string;
}

function isLocalhostSocket(socket: Io.Socket) {
	if (socket.handshake.query?.isHelper === 'true') {
		return true;
	}
	const remoteAddress = socket.request.socket.remoteAddress ?? '';
	return (
		remoteAddress.includes(LOCALHOST_SOCKET_IP) ||
		remoteAddress === '::1' ||
		remoteAddress.includes('::ffff:127.0.0.1') ||
		remoteAddress === 'localhost'
	);
}

export default class Socket implements SocketOPTS {
	roomId: string;

	socket: Io.Socket;

	room: Room;

	roomIdOriginal: string;

	constructor(opts: SocketOPTS) {
		const { roomId, socket, room, roomIdOriginal } = opts;

		this.roomId = roomId;
		this.socket = socket;
		this.roomIdOriginal = roomIdOriginal;
		this.room = room;
		const users = room.users || [];
		if (room.isLocked && users.length > 1) {
			this.sendRoomLocked();
			return;
		}
		if (room.isLocked && users.length <= 1) {
			this.room.isLocked = false;
			void this.saveRoom(this.room);
		}

		this.handleSocket();
		this.init();
	}

	async init(): Promise<void> {
		await this.joinRoom();
	}

	sendRoomLocked(): void {
		this.socket.emit('ROOM_LOCKED');
	}

	async saveRoom(room: Room): Promise<number> {
		const json = {
			...room,
			updatedAt: Date.now(),
		};
		return getStore().set('rooms', this.roomId, JSON.stringify(json));
	}

	async destroyRoom(): Promise<0 | 1> {
		return getStore().del('rooms', this.roomId);
	}

	async fetchRoom(): Promise<unknown> {
		const res = await getStore().get('rooms', this.roomId);
		if (typeof res !== 'string') {
			return {};
		}
		return JSON.parse(res);
	}

	joinRoom(): Promise<unknown> {
		return new Promise((resolve) => {
			this.socket.join(this.roomId);
			resolve(undefined);
		});
	}

	handleSocket(): void {
		this.socket.on('GET_MY_IP', (acknowledgeFunction) => {
			acknowledgeFunction(socketsIPService.getSocketIPByID(this.socket.id));
		});

		this.socket.on('GET_IP_BY_SOCKET_ID', (socketID, acknowledgeFunction) => {
			if (!isLocalhostSocket(this.socket)) {
				return;
			}
			const ip = socketsIPService.getSocketIPByID(socketID) || '127.0.0.1';
			if (typeof acknowledgeFunction === 'function') {
				acknowledgeFunction(ip);
			}
		});

		this.socket.on('IS_ROOM_LOCKED', async (acknowledgeFunction) => {
			const room: Room = (await this.fetchRoom()) as Room;
			acknowledgeFunction(room.isLocked);
		});

		this.socket.on('PING', (acknowledgeFunction) => {
			acknowledgeFunction('PONG');
		});

		this.socket.on('MESSAGE', (payload) => {
			payload.fromSocketID = this.socket.id;
			this.socket.to(this.roomId).emit('MESSAGE', payload);
		});

		this.socket.on('DISCONNECT_SOCKET_BY_DEVICE_IP', async (payload) => {
			const room: Room = (await this.fetchRoom()) as Room;
			const ownerUser = (room.users || []).find(
				(u) => u.socketId === this.socket.id && u.isOwner,
			);
			if (!ownerUser) return;
			const socketIDToDisconnect = socketsIPService.getSocketIDByIP(payload.ip);
			if (!socketIDToDisconnect) return;

			this.handleDisconnect(
				socketIOServerStore.getServer().sockets.sockets[socketIDToDisconnect],
			);
		});

		this.socket.on('USER_ENTER', async (payload) => {
			let room: Room = (await this.fetchRoom()) as Room;
			if (_.isEmpty(room)) {
				room = {
					id: this.roomId,
					users: [],
					isLocked: false,
					createdAt: Date.now(),
				};
			} else {
				const userFound = room.users.find(
					(r) => r.username === payload.username,
				);
				if (userFound) return;
			}

			const isHelperSocket = this.socket.handshake.query?.isHelper === 'true';
			const isOwnerSocket = isHelperSocket;
			if (!isOwnerSocket) {
				const connectedViewers = (room.users || []).filter((user) => {
					return !user.isOwner;
				});
				if (connectedViewers.length >= 5) {
					this.socket.emit('NOT_ALLOWED');
					setTimeout(() => {
						this.socket.disconnect(true);
					}, 0);
					return;
				}
			}

			const newRoom: Room = {
				...room,
				users: [
					...(room.users || []),
					{
						socketId: this.socket.id,
						username: payload.username,
						isOwner: isOwnerSocket,
						ip: payload.ip ? payload.ip : '', // TODO: remove as it is not used
					},
				],
			};
			await this.saveRoom(newRoom);

			socketIOServerStore
				.getServer()
				.to(this.roomId)
				.emit('USER_ENTER', {
					...newRoom,
					id: this.roomIdOriginal,
				});
		});

		this.socket.on('TOGGLE_LOCK_ROOM', async () => {
			// TODO: in here if there is somehow already more than ONE client connected, then we were spoofed! Need to add code to interrupt connection immediately.
			const room: Room = (await this.fetchRoom()) as Room;
			const user = (room.users || []).find(
				(u) => u.socketId === this.socket.id && u.isOwner,
			);

			if (!user) {
				return;
			}

			await this.saveRoom({
				...room,
				isLocked: !room.isLocked,
			});
		});

		this.socket.on('disconnect', () => {
			this.handleDisconnect(this.socket);
		});

		this.socket.on('USER_DISCONNECT', () => {
			this.handleDisconnect(this.socket);
		});
	}

	async handleDisconnect(socket: Io.Socket): Promise<void> {
		const room: Room = (await this.fetchRoom()) as Room;
		const isOwnerUser = !!(room.users || []).find(
			(u) => u.socketId === socket.id && u.isOwner,
		);

		const remainingUsers = (room.users || []).filter(
			(u) => u.socketId !== socket.id,
		);

		const newRoom = {
			...room,
			isLocked: remainingUsers.length <= 1 ? false : room.isLocked,
			users: remainingUsers,
		};

		if (isOwnerUser) {
			this.disconnectAllUsers(newRoom);
			await this.destroyRoom();
		} else {
			await this.saveRoom(newRoom);
		}

		socketIOServerStore
			.getServer()
			.to(this.roomId)
			.emit('USER_EXIT', newRoom.users);

		socket.disconnect(true);
	}

	disconnectAllUsers(room: Room): void {
		room.users.forEach((u) => {
			if (socketIOServerStore.getServer().sockets.sockets[u.socketId]) {
				socketIOServerStore
					.getServer()
					.sockets.sockets[u.socketId].disconnect();
			}
		});
	}
}
