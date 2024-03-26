import EventEmitter from "events";
import { createConnection, Socket } from "net";
import {
	ReceiverDataFormat,
	TransmitterDataFormat,
	TransmitterCreateOptions,
	TransmitterOptions,
	TransmitterAnaylzeDataFormat,
} from "../typings/interface.js";
import { Key, PossibleDatabaseTypes, Value } from "../typings/type.js";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import { KeyValueData } from "../../index.js";
import { randomBytes } from "crypto";
import { ReceiverOpCodes, TransmitterOpCodes } from "../typings/enum.js";
import { inspect } from "util";
export default class Transmitter<
	Type extends PossibleDatabaseTypes
> extends EventEmitter {
	client: Socket;
	options: TransmitterOptions<Type>;
	data = {
		seq: 0,
		lastPingTimestamp: -1,
		ping: -1,
	};
	pingInterval: NodeJS.Timeout | null = null;
	readyAt = -1;
	session!: string;
	#maxRetries = 10;
	#retries = 0;
	#waitTime = 1000;
	constructor(options: TransmitterOptions<Type>) {
		super();
		this.client = createConnection(options, () => {
			const reqData = this.sendDataFormat(
				TransmitterOpCodes.Connect,
				DatabaseMethod.NOOP,
				Date.now(),
				this.data.seq,
				{
					u: options.username,
					p: options.password,
				}
			);
			this.data.lastPingTimestamp = Date.now();
			this.client.write(reqData);
		});
		this.options = options;
	}
	static createConnection<Type extends PossibleDatabaseTypes>(
		options: TransmitterCreateOptions<Type>
	) {
		if (!options.path.startsWith("aoidb://"))
			throw new Error(
				"Invalid Protocol Provided for Transmitter. Required: aoidb://"
			);
		const [_, username, password, host, port] =
			options.path.split(/aoidb:\/\/|:|@/);
		return new Transmitter({
			host,
			port: Number(port),
			username,
			password,
		});
	}
	#createDebug(data: TransmitterDataFormat) {
		this.emit(
			DatabaseEvents.Debug,
			`[Debug: Transmitter -> Sent Data]: ${inspect(data)}`
		);
	}

	#createData(data: ReceiverDataFormat) {
		this.emit(
			DatabaseEvents.Data,
			`[Debug: Transmitter -> Received Data]: ${inspect(data)}`
		);
	}

	#bindEvents() {
		this.client.on("data", (buffer) => {
			const data = this.receiveDataFormat(buffer);
			this.data.seq = data.s;
			switch (data.op) {
				case ReceiverOpCodes.ConnectionDenied: {
					this.emit(DatabaseEvents.Disconnect, data.d);
					this.data.ping = Date.now() - this.data.lastPingTimestamp;
					return;
				}
				case ReceiverOpCodes.AckConnect:
					{
						this.session = data.se;
						this.emit("AckConnect", data.d);
					}
					break;
				case ReceiverOpCodes.Pong:
					{
						this.data.ping =
							Date.now() - this.data.lastPingTimestamp;
					}
					break;
			}

			this.#createData(data);
		});
		this.client.on("close", () => {
			this.emit(DatabaseEvents.Disconnect, "Connection Closed");
			this.#reconnect();
		});
		this.client.on("error", (err) => {
			this.emit(DatabaseEvents.Error, err);
			this.#reconnect();
		});
		this.client.on("connect", () => {
			this.emit(DatabaseEvents.Connect, "Connected");
		});
	}

	#reconnect() {
		try {
			clearInterval(this.pingInterval!);
			this.client = createConnection(this.options, () => {
				this.#retries = 0;
				const reqData = this.sendDataFormat(
					TransmitterOpCodes.Connect,
					DatabaseMethod.NOOP,
					Date.now(),
					this.data.seq,
					{
						u: this.options.username,
						p: this.options.password,
					}
				);
				this.data.lastPingTimestamp = Date.now();
				this.client.write(reqData);
			});
			this.connect();
		} catch (err) {
			if (this.#retries < this.#maxRetries) {
				this.#retries++;
				setTimeout(() => {
					this.#reconnect();
				}, this.#waitTime * this.#retries);
			} else {
				this.emit(DatabaseEvents.Disconnect, "Max Retries Reached");
			}
		}
	}

	connect() {
		this.#bindEvents();
		this.ping();
		this.pingInterval = setInterval(() => {
			this.ping();
		}, 30000);
		this.readyAt = Date.now();
		this.#retries = 0;
	}

	receiveDataFormat(buffer: Buffer) {
		const data = JSON.parse(buffer.toString());
		return data as ReceiverDataFormat;
	}
	sendDataFormat(
		op: TransmitterOpCodes,
		method: DatabaseMethod,
		timestamp: number,
		seq: number,
		data?: unknown
	) {
		return Buffer.from(
			JSON.stringify({
				op: op,
				m: method,
				t: timestamp,
				d: data,
				s: seq,
				h: randomBytes(16).toString("hex"),
				se: this.session,
			})
		);
	}

	ping() {
		this.data.lastPingTimestamp = Date.now();
		this.client.write(
			this.sendDataFormat(
				TransmitterOpCodes.Ping,
				DatabaseMethod.Ping,
				this.data.lastPingTimestamp,
				this.data.seq
			)
		);
	}
	async #req(
		op: TransmitterOpCodes,
		method: DatabaseMethod,
		data: any
	): Promise<ReceiverDataFormat> {
		return new Promise((resolve, reject) => {
			const sendData = this.sendDataFormat(
				op,
				method,
				Date.now(),
				this.data.seq,
				data
			);

			const _req = (buffer: Buffer) => {
				const data = this.receiveDataFormat(buffer);
				const sendD = JSON.parse(
					sendData.toString()
				) as ReceiverDataFormat;
				if ((data.op === op, data.m === method && data.h === sendD.h)) {
					resolve(data);
				}

				this.client.off("data", _req);
			};

			this.client.write(sendData);
			this.#createDebug(data);
			this.client.on("data", _req);
		});
	}
	async get(table: string, key: Key<Type>): Promise<KeyValueData | null> {
		const data = (
			await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.Get, {
				table,
				key,
			})
		).d;

		if (!data) return null;
		return new KeyValueData(data);
	}

	async set(table: string, key: Key<Type>, value: Value<Type>) {
		return (
			await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.Set, {
				table,
				key,
				value,
			})
		).d;
	}

	async delete(table: string, key: Key<Type>): Promise<any> {
		return (
			await this.#req(
				TransmitterOpCodes.Operation,
				DatabaseMethod.Delete,
				{
					table,
					key,
				}
			)
		).d;
	}

	async clear(table: string): Promise<void> {
		return (
			await this.#req(
				TransmitterOpCodes.Operation,
				DatabaseMethod.Clear,
				{
					table,
				}
			)
		).d;
	}

	async all(
		table: string,
		query?: (data: KeyValueData) => boolean,
		limit?: number
	): Promise<Type extends "KeyValue" ? KeyValueData[] : never> {
		return (
			await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.All, {
				table,
				query:
					query?.toString() ?? ((_: KeyValueData) => true).toString(),
				limit,
			})
		).d.map((x: any) => new KeyValueData(x));
	}

	async has(table: string, key: Key<Type>): Promise<boolean> {
		return (
			await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.Has, {
				table,
				key,
			})
		).d;
	}
	async findOne(
		table: string,
		query: (data: KeyValueData) => boolean
	): Promise<KeyValueData | null> {
		const data = (
			await this.#req(
				TransmitterOpCodes.Operation,
				DatabaseMethod.FindOne,
				{
					table,
					query: query.toString(),
				}
			)
		).d;
		if (!data) return null;
		return new KeyValueData(data);
	}
	async findMany(table: string, query: (data: KeyValueData) => boolean) {
		return (
			await this.#req(
				TransmitterOpCodes.Operation,
				DatabaseMethod.FindMany,
				{
					table,
					query: query.toString(),
				}
			)
		).d.map((x: any) => new KeyValueData(x));
	}

	async deleteMany(table: string, query: (data: KeyValueData) => boolean) {
		return (
			await this.#req(
				TransmitterOpCodes.Operation,
				DatabaseMethod.DeleteMany,
				{
					table,
					query: query.toString(),
				}
			)
		).d;
	}

	async analyze(table: string, data: TransmitterAnaylzeDataFormat) {
		const sendD = this.sendDataFormat(
			TransmitterOpCodes.Analyze,
			DatabaseMethod[data.method],
			Date.now(),
			this.data.seq
		);
		const res = await this.#req(
			TransmitterOpCodes.Analyze,
			DatabaseMethod[data.method],
			{
				table,
				data,
			}
		);

		return this.#formatAnalyzeData(
			res,
			JSON.parse(sendD.toString()) as TransmitterDataFormat
		);
	}

	#formatAnalyzeData(data: ReceiverDataFormat, sednD: TransmitterDataFormat) {
		const res = {
			opCode: data.op,
			method: DatabaseMethod[data.m],
			timestamp: data.t,
			seq: data.s,
			data: {
				value: data.d,
				delay: {
					toServer: data.t - sednD.t,
					toClient: Date.now() - data.t,
					ping: this.data.ping,
				},
			},
			cost: data.c,
			hash: data.h,
		};

		return res;
	}
}
