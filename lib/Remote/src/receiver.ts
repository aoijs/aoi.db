import EventEmitter from "node:events";
import { Server, Socket, createServer, isIPv6 } from "node:net";
import {
	ISocket,
	ReceiverDataFormat,
	ReceiverOptions,
	TransmitterDataFormat,
} from "../typings/interface.js";
import {
	DatabaseEvents,
	DatabaseMethod,
	KeyValue,
	KeyValueData,
} from "../../index.js";
import { DatabaseOptions } from "../typings/type.js";
import {
	Permissions,
	ReceiverOpCodes,
	TransmitterOpCodes,
} from "../typings/enum.js";
import { randomBytes } from "node:crypto";
import { Group } from "@akarui/structures";
import { inspect } from "node:util";

export default class Receiver extends EventEmitter {
	server: Server;
	#options: ReceiverOptions;
	allowList: Set<string> = new Set();
	clients: Group<string, Socket> = new Group(Infinity);
	usersMap: Group<string, KeyValue> = new Group(Infinity);
	constructor(options: ReceiverOptions) {
		super();
		this.#options = options;
		this.server = createServer();
		this.server.listen(options.port, options.host, options.backlog, () => {
			this.emit(DatabaseEvents.Connect);
		});
		this.#init(options);
	}

    allowAddress(address: string) {
        this.allowList.add(address);
    }


	#init(options: ReceiverOptions) {
		// create database and setup user config
		const { userConfig, databaseType, databaseOptions } = options;
		let db: KeyValue | null = null;
		if (databaseType === "KeyValue") {
			db = this.#createKeyValue(databaseOptions);
		}

		if (!db) {
			throw new Error("Database type not found");
		}

		for (const user of userConfig) {
			this.usersMap.set(user.username, db);
		}
	}

	#createKeyValue(options: DatabaseOptions<"KeyValue">) {
		const db = new KeyValue(options);
		db.connect();
		return db;
	}

	isAllowed(address: string) {
		let ipv6 = isIPv6(address) ? address : "::ffff:" + address;
		return this.allowList.has("*") || this.allowList.has(ipv6);
	}

	async #bindEvents() {
		this.server.on("connection", (socket: ISocket) => {
			socket.on("connect", () => this.#handleConnect(socket));

			socket.on("data", (data: Buffer) => this.#handleData(data, socket));

            socket.on("error", (err) => this.#handleError(err, socket));

            socket.on("close", () => this.#handleClose(socket));
		});
	}

    #handleClose(socket: ISocket) {
        this.emit(DatabaseEvents.Disconnect, socket);
    }

    #handleError(err: Error, socket: ISocket) {
        this.emit(DatabaseEvents.Error, err, socket);
    }

	#handleConnect(socket: Socket) {
		this.emit(DatabaseEvents.Connection, socket);
	}

	async #handleData(data: Buffer, socket: ISocket) {
		const dataFormat = this.transmitterDataFormat(data);
		const op = dataFormat.op;

		switch (op) {
			case TransmitterOpCodes.Connect:
				this.#handleConnectRequest(dataFormat, socket);
				break;
			case TransmitterOpCodes.Ping:
				this.#handlePingRequest(dataFormat, socket);
				break;
			case TransmitterOpCodes.Disconnect:
				this.#handleDisconnectRequest(dataFormat, socket);
				break;
			case TransmitterOpCodes.Operation:
				await this.#handleOperationRequest(dataFormat, socket);
				break;
			default:
				this.#handleUnknownRequest(dataFormat, socket);
				break;
		}

		this.#createData(dataFormat);
	}

	#handleConnectRequest(dataFormat: TransmitterDataFormat, socket: ISocket) {
		const { s, d, h } = dataFormat;
		const { u, p } = d;
		const db = this.usersMap.get(u);
		if (!this.isAllowed(socket.remoteAddress!)) {
			return this.#sendResponse(
				{
					op: ReceiverOpCodes.ConnectionDenied,
					method: DatabaseMethod.NOOP,
					seq: s,
					data: "Connection Denied",
					cost: 0,
					hash: h,
					session: "",
				},
				socket
			);
		}
		if (!db) {
			this.#sendResponse(
				{
					op: ReceiverOpCodes.ConnectionDenied,
					method: DatabaseMethod.NOOP,
					seq: s,
					data: "User not found",
					cost: 0,
					hash: h,
					session: "",
				},
				socket
			);
			return;
		}

		if (
			!this.#options.userConfig.find(
				(user) =>
					user.username === u && user.password === p
			)
		) {
			this.#sendResponse(
				{
					op: ReceiverOpCodes.ConnectionDenied,
					method: DatabaseMethod.NOOP,
					seq: s,
					data: "Invalid password",
					cost: 0,
					hash: h,
					session: "",
				},
				socket
			);
			return;
		}
		const session = randomBytes(16).toString("hex");
		// @ts-ignore
		socket.userData = {
			username:u,
			session,
			permissions: this.#options.userConfig.find(
				(user) => user.username === u
			)?.permissions as Permissions,
		};
		this.clients.set(session, socket);

		this.#sendResponse(
			{
				op: ReceiverOpCodes.AckConnect,
				method: DatabaseMethod.NOOP,
				seq: s,
				data: "Connected",
				cost: 0,
				hash: h,
				session,
			},
			socket
		);
	}

	#handlePingRequest(dataFormat: TransmitterDataFormat, socket: ISocket) {
		const { s, h, se } = dataFormat;
		this.#sendResponse(
			{
				op: ReceiverOpCodes.Pong,
				method: DatabaseMethod.NOOP,
				seq: s,
				data: "Pong",
				cost: 0,
				hash: h,
				session: se,
			},
			socket
		);
	}

	#handleDisconnectRequest(
		dataFormat: TransmitterDataFormat,
		socket: ISocket
	) {
		const { s, h, se } = dataFormat;
		this.clients.delete(se);
		this.#sendResponse(
			{
				op: ReceiverOpCodes.AckDisconnect,
				method: DatabaseMethod.NOOP,
				seq: s,
				data: "Disconnected",
				cost: 0,
				hash: h,
				session: se,
			},
			socket
		);
	}

	async #handleOperationRequest(
		dataFormat: TransmitterDataFormat,
		socket: ISocket
	) {
		const { se, s, h, m } = dataFormat;
        const db = this.usersMap.get(socket.userData.username)
		if (!db) {
			return this.#sendResponse(
				{
					op: ReceiverOpCodes.ConnectionDenied,
					method: DatabaseMethod.NOOP,
					seq: s,
					data: "User not found",
					cost: 0,
					hash: h,
					session: se,
				},
				socket
			);
		}

		switch (m) {
			case DatabaseMethod.Set:
				await this.#handleOperationSet(dataFormat, socket);
				break;
			case DatabaseMethod.Get:
				await this.#handleOperationGet(dataFormat, socket);
				break;
			case DatabaseMethod.Delete:
				await this.#handleOperationDelete(dataFormat, socket);
				break;
			case DatabaseMethod.All:
				await this.#handleOperationAll(dataFormat, socket);
				break;
			case DatabaseMethod.FindMany:
                await this.#handleOperationFindMany(dataFormat, socket);
                break;
            case DatabaseMethod.FindOne:
                await this.#handleOperationFindOne(dataFormat, socket);
                break;
            case DatabaseMethod.Has:
                await this.#handleOperationHas(dataFormat, socket);
                break;
            case DatabaseMethod.DeleteMany:
                await this.#handleOperationDeleteMany(dataFormat, socket);
                break;
			default: {
				this.#sendResponse(
					{
						op: ReceiverOpCodes.ConnectionDenied,
						method: DatabaseMethod.NOOP,
						seq: s,
						data: "Unknown Operation",
						cost: 0,
						hash: h,
						session: se,
					},
					socket
				);
				break;
			}
		}
	}

	#handleUnknownRequest(dataFormat: TransmitterDataFormat, socket: ISocket) {
		const { s, h, se } = dataFormat;
		this.#sendResponse(
			{
				op: ReceiverOpCodes.ConnectionDenied,
				method: DatabaseMethod.NOOP,
				seq: s,
				data: "Unknown Request",
				cost: 0,
				hash: h,
				session: se,
			},
			socket
		);
	}

	async #handleOperationSet(
		dataFormat: TransmitterDataFormat,
		socket: ISocket
	) {
		const { s, m, d, h, se } = dataFormat;
		if (socket.userData.permissions === Permissions.ROnly) {
			return this.#sendResponse(
				{
					op: ReceiverOpCodes.ConnectionDenied,
					method: DatabaseMethod.NOOP,
					seq: s,
					data: "Permission Denied",
					cost: 0,
					hash: h,
					session: se,
				},
				socket
			);
		}
		const { table, key, value } = d;
		const db = this.usersMap.get(socket.userData.username) as KeyValue;
		const startTime = performance.now();
		await db.set(table, key, {
			value,
		});
		const endTime = performance.now();
		const cost = endTime - startTime;

		this.#sendResponse(
			{
				op: ReceiverOpCodes.AckOperation,
				method: DatabaseMethod.Set,
				seq: s + 1,
				data: "",
				cost: cost,
				hash: h,
				session: se,
			},
			socket
		);
	}

	async #handleOperationGet(
		dataFormat: TransmitterDataFormat,
		socket: ISocket
	) {
		const { s, m, d, h, se } = dataFormat;
		if (socket.userData.permissions === Permissions.WOnly) {
			return this.#sendResponse(
				{
					op: ReceiverOpCodes.ConnectionDenied,
					method: DatabaseMethod.NOOP,
					seq: s,
					data: "Permission Denied",
					cost: 0,
					hash: h,
					session: se,
				},
				socket
			);
		}

		const { table, key } = d;
		const db = this.usersMap.get(socket.userData.username) as KeyValue;
		const startTime = performance.now();
		const res = await db.get(table, key) as KeyValueData;
		const endTime = performance.now();
		const cost = endTime - startTime;

		this.#sendResponse(
			{
				op: ReceiverOpCodes.AckOperation,
				method: DatabaseMethod.Get,
				seq: s,
				data: res?.toJSON(),
				cost: cost,
				hash: h,
				session: se,
			},
			socket
		);
	}

	async #handleOperationDelete(
		dataFormat: TransmitterDataFormat,
		socket: ISocket
	) {
		const { s, m, d, h, se } = dataFormat;
		if (socket.userData.permissions === Permissions.ROnly) {
			return this.#sendResponse(
				{
					op: ReceiverOpCodes.ConnectionDenied,
					method: DatabaseMethod.NOOP,
					seq: s,
					data: "Permission Denied",
					cost: 0,
					hash: h,
					session: se,
				},
				socket
			);
		}

		const { table, key } = d;
		const db = this.usersMap.get(socket.userData.username) as KeyValue;

		const startTime = performance.now();
		const res = await db.delete(table, key);
		const endTime = performance.now();
		const cost = endTime - startTime;

		this.#sendResponse(
			{
				op: ReceiverOpCodes.AckOperation,
				method: DatabaseMethod.Delete,
				seq: s,
				data: res,
				cost: cost,
				hash: h,
				session: se,
			},
			socket
		);
	}

	async #handleOperationAll(
		dataFormat: TransmitterDataFormat,
		socket: ISocket
	) {
		const { s, m, d, h, se } = dataFormat;
		if (socket.userData.permissions === Permissions.WOnly) {
			return this.#sendResponse(
				{
					op: ReceiverOpCodes.ConnectionDenied,
					method: DatabaseMethod.NOOP,
					seq: s,
					data: "Permission Denied",
					cost: 0,
					hash: h,
					session: se,
				},
				socket
			);
		}

		const { table, query, limit, order } = d;
		const db = this.usersMap.get(socket.userData.username) as KeyValue;
		const startTime = performance.now();
		const res = await eval(`db.all(table, ${query}, ${limit},order)`);
		const endTime = performance.now();
		const cost = endTime - startTime;

		this.#sendResponse(
			{
				op: ReceiverOpCodes.AckOperation,
				method: DatabaseMethod.All,
				seq: s,
				data: res,
				cost: cost,
				hash: h,
				session: se,
			},
			socket
		);
	}

    async #handleOperationFindMany(dataFormat: TransmitterDataFormat, socket: ISocket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.WOnly) {
            return this.#sendResponse(
                {
                    op: ReceiverOpCodes.ConnectionDenied,
                    method: DatabaseMethod.NOOP,
                    seq: s,
                    data: "Permission Denied",
                    cost: 0,
                    hash: h,
                    session: se,
                },
                socket
            );
        }

        const { table, query } = d;
        const db = this.usersMap.get(socket.userData.username) as KeyValue;
        const startTime = performance.now();
        const res = await eval(`db.findMany(table, ${query})`);
        const endTime = performance.now();
        const cost = endTime - startTime;

        this.#sendResponse(
            {
                op: ReceiverOpCodes.AckOperation,
                method: DatabaseMethod.FindMany,
                seq: s,
                data: res,
                cost: cost,
                hash: h,
                session: se,
            },
            socket
        );
    
    }

    async #handleOperationFindOne(dataFormat: TransmitterDataFormat, socket: ISocket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.WOnly) {
            return this.#sendResponse(
                {
                    op: ReceiverOpCodes.ConnectionDenied,
                    method: DatabaseMethod.NOOP,
                    seq: s,
                    data: "Permission Denied",
                    cost: 0,
                    hash: h,
                    session: se,
                },
                socket
            );
        }

        const { table, query } = d;
        const db = this.usersMap.get(socket.userData.username) as KeyValue;
        const startTime = performance.now();
        const res = await eval(`db.findOne(table, ${query})`);
        const endTime = performance.now();
        const cost = endTime - startTime;

        this.#sendResponse(
            {
                op: ReceiverOpCodes.AckOperation,
                method: DatabaseMethod.FindOne,
                seq: s,
                data: res,
                cost: cost,
                hash: h,
                session: se,
            },
            socket
        );
    }

    async #handleOperationHas(dataFormat: TransmitterDataFormat, socket: ISocket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.WOnly) {
            return this.#sendResponse(
                {
                    op: ReceiverOpCodes.ConnectionDenied,
                    method: DatabaseMethod.NOOP,
                    seq: s,
                    data: "Permission Denied",
                    cost: 0,
                    hash: h,
                    session: se,
                },
                socket
            );
        }

        const { table, key } = d;
        const db = this.usersMap.get(socket.userData.username) as KeyValue;
        const startTime = performance.now();
        const res = await db.has(table, key);
        const endTime = performance.now();
        const cost = endTime - startTime;

        this.#sendResponse(
            {
                op: ReceiverOpCodes.AckOperation,
                method: DatabaseMethod.Has,
                seq: s,
                data: res,
                cost: cost,
                hash: h,
                session: se,
            },
            socket
        );
    }

    async #handleOperationDeleteMany(dataFormat: TransmitterDataFormat, socket: ISocket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.ROnly) {
            return this.#sendResponse(
                {
                    op: ReceiverOpCodes.ConnectionDenied,
                    method: DatabaseMethod.NOOP,
                    seq: s,
                    data: "Permission Denied",
                    cost: 0,
                    hash: h,
                    session: se,
                },
                socket
            );
        }

        const { table, query } = d;
        const db = this.usersMap.get(socket.userData.username) as KeyValue;
        const startTime = performance.now();
        const res = await eval(`db.deleteMany(table, ${query})`);
        const endTime = performance.now();
        const cost = endTime - startTime;

        this.#sendResponse(
            {
                op: ReceiverOpCodes.AckOperation,
                method: DatabaseMethod.DeleteMany,
                seq: s,
                data: res,
                cost: cost,
                hash: h,
                session: se,
            },
            socket
        );
    }

    async #handleOperationClear(dataFormat: TransmitterDataFormat, socket: ISocket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.ROnly) {
            return this.#sendResponse(
                {
                    op: ReceiverOpCodes.ConnectionDenied,
                    method: DatabaseMethod.NOOP,
                    seq: s,
                    data: "Permission Denied",
                    cost: 0,
                    hash: h,
                    session: se,
                },
                socket
            );
        }

        const { table } = d;
        const db = this.usersMap.get(socket.userData.username) as KeyValue;
        const startTime = performance.now();
        const res = await db.clear(table);
        const endTime = performance.now();
        const cost = endTime - startTime;

        this.#sendResponse(
            {
                op: ReceiverOpCodes.AckOperation,
                method: DatabaseMethod.Clear,
                seq: s,
                data: res,
                cost: cost,
                hash: h,
                session: se,
            },
            socket
        );
    }

	#sendResponse(
		data: {
			op: ReceiverOpCodes;
			method: DatabaseMethod;
			seq: number;
			data: any;
			cost: number;
			hash: string;
			session: string;
		},
		socket: Socket
	) {
		const buffer = this.sendDataFormat(data);
		socket.write(buffer);
        this.#createDebug(data)
	}

    #createDebug(data: {
        op: ReceiverOpCodes;
        method: DatabaseMethod;
        seq: number;
        data: any;
        cost: number;
        hash: string;
        session: string;
    }) {
		this.emit(
			DatabaseEvents.Debug,
			`[Debug: Reciever ->  Sent Data]: ${inspect(data)}`
		);
	}

	#createData(data: TransmitterDataFormat) {
		this.emit(
			DatabaseEvents.Data,
			`[Debug: Receiver -> Received Data]: ${inspect(data)}`
		);
	}

	sendDataFormat({
		op,
		method,
		seq,
		data,
		cost,
		hash,
		session,
	}: {
		op: ReceiverOpCodes;
		method: DatabaseMethod;
		seq: number;
		data: any;
		cost: number;
		hash: string;
		session: string;
	}) {
		const res = {
			op: op,
			m: method,
			t: Date.now(),
			s: seq,
			d: data,
			c: cost,
			h: hash,
			se: session,
		} as ReceiverDataFormat;
		return Buffer.from(JSON.stringify(res));
	}
	transmitterDataFormat(buffer: Buffer) {
		return JSON.parse(buffer.toString()) as TransmitterDataFormat;
	}

	connect() {
		return this.#bindEvents();
	}
}
