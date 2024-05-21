import { PriorityQueue } from "@akarui/structures";
import Data from "./data.js";
import LRUCache from "./LRUcache.js";
import fs, { fsyncSync } from "node:fs";
//@ts-ignore
import JSONStream from "JSONStream";
import { KeyValueJSONOption } from "../typings/interface.js";
import Table from "./Table.js";
import { decrypt, encrypt } from "../../utils.js";
import {
	close,
	fstat,
	fsync,
	ftruncate,
	open,
	read,
	write,
} from "../../promisifiers.js";
import { DatabaseMethod } from "../../typings/enum.js";
import { platform } from "node:os";
import path from "node:path";
import Mutex from "./Mutex.js";

export default class File {
	#cache: LRUCache;
	#path: string;
	#fd!: number;
	#size: number;
	#locked = false;
	#isDirty: boolean;
	#flushQueue: Data[];
	#removeQueue: Data["key"][];
	#interval!: NodeJS.Timeout;
	#retries = 0;
	#table: Table;
	#mutex: Mutex = new Mutex();
	constructor(path: string, capacity: number, table: Table) {
		this.#cache = new LRUCache(capacity);
		this.#path = path;
		this.#table = table;
		this.#size = 0;
		this.#isDirty = false;
		this.#flushQueue = [];
		this.#removeQueue = [];

		// Open file
		this.#fd = fs.openSync(
			this.#path,
			fs.constants.O_RDWR | fs.constants.O_CREAT
		);
	}

	async init() {
		const statSize = await fstat(this.#fd);
		if (statSize.size === 0) {
			await write(this.#fd, Buffer.from("{}"), 0, 2, 0);
		}
		await this.#checkIntegrity().catch((e) => {
			this.#isDirty = true;
			throw e;
		});
		this.#enableInterval();
	}

	get name() {
		return this.#path.split("/").pop()!.split(".")[0];
	}

	#enableInterval() {
		if (this.#isDirty) return;
		this.#interval = setInterval(async () => {
			if (
				this.#flushQueue.length === 0 &&
				this.#removeQueue.length === 0
			) {
				return;
			}
			await this.#atomicFlush();
		}, 500);
	}

	get size() {
		return this.#size;
	}

	get path() {
		return this.#path;
	}

	get cache() {
		return this.#cache;
	}

	get isDirty() {
		return this.#isDirty;
	}

	get locked() {
		return this.#mutex.isLocked();
	}

	get flushQueue() {
		return this.#flushQueue;
	}

	get interval() {
		return this.#interval;
	}

	async #checkIntegrity() {
		await new Promise<void>(async (resolve, reject) => {
			try {
				if (!this.#table.db.options.fileConfig.staticRehash) {
					await this.getAll();
					resolve();
				} else {
					// const jsonstream = JSONStream.parse("*");
					// const stream = fs.createReadStream(this.#path);
					// stream.pipe(jsonstream);
					// jsonstream.on("data", (data: KeyValueJSONOption) => {
					// 	this.#size++;
					// 	this.#cache.put(
					// 		data.key,
					// 		new Data({
					// 			key: data.key,
					// 			value: data.value,
					// 			type: data.type,
					// 			file: this.#path,
					// 		})
					// 	);
					// });

					// jsonstream.on("end", () => {
					// 	resolve();
					// });
					const json = JSON.parse( await fs.promises.readFile(this.#path, "utf-8"));
					resolve();
				}
			} catch (e) {
				this.#isDirty = true;
				reject(e);
			}
		});
	}

	async get(key: string): Promise<Data | undefined> {
		if (this.#cache.has(key)) {
			return this.#cache.get(key);
		}
		const idx = this.#flushQueue.findIndex((data) => data.key === key);

		if (idx !== -1) {
			return this.#flushQueue[idx];
		}

		if (this.#isDirty) {
			return;
		}

		const value = await this.#getFromDisk(key);
		return value;
	}

	async #getFromDisk(key: string): Promise<Data | undefined> {
		await this.#mutex.lock();
		let value: Data | undefined;
		try {
			let json = JSON.parse(
				await fs.promises.readFile(this.#path, "utf-8")
			);
			if (this.#table.db.options.encryptionConfig.encriptData) {
				const decryptedData = decrypt(
					json,
					this.#table.db.options.encryptionConfig.securityKey
				);
				json = JSON.parse(decryptedData);
			}
			if (json[key]) {
				value = new Data({
					key: key,
					value: json[key].value,
					type: json[key].type,
					file: this.#path,
				});
				this.#cache.put(key, value);
			}
		} finally {
			this.#mutex.unlock();
		}
		return value;
	}

	async put(key: string, value: Data): Promise<void> {
		this.#cache.put(key, value);
		this.#size++;
		this.#flushQueue.push(value);
	}

	async #atomicFlush() {
		await this.#mutex.lock();
		const dir = path.dirname(this.#path);
		const opendir = await fs.promises.open(dir, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
		const tempFile = `${this.#path}.tmp`;
		const tmpfd = fs.openSync(
			tempFile,
			fs.constants.O_RDWR | fs.constants.O_CREAT
		);
		let json = JSON.parse(await fs.promises.readFile(this.#path, "utf-8"));
		if (this.#table.db.options.encryptionConfig.encriptData) {
			const decryptedData = decrypt(
				json,
				this.#table.db.options.encryptionConfig.securityKey
			);
			json = decryptedData;
		}
		for (const data of this.#flushQueue) {
			json[data.key] = data;
		}
		for (const data of this.#removeQueue) {
			delete json[data];
		}
		let writeData;
		if (this.#table.db.options.encryptionConfig.encriptData) {
			writeData = JSON.stringify(
				encrypt(
					JSON.stringify(json),
					this.#table.db.options.encryptionConfig.securityKey
				)
			);
		} else {
			writeData = JSON.stringify(json);
		}
		const buffer = Buffer.from(writeData);
		await write(tmpfd, buffer, 0, buffer.length, 0);
		await fsync(tmpfd);
		await close(tmpfd);
		await close(this.#fd);

		await this.#retry(
			async () => {
				if(platform() === "win32") {
					await fs.promises.unlink(this.#path);
					await fs.promises.rename(tempFile, this.#path);
					await opendir.sync()
					await opendir.close()
					
				}
				else {
					await fs.promises.rename(tempFile, this.#path);
					await opendir.sync()
					await opendir.close()
				}
			},
			10,
			100
		);
		this.#fd = fs.openSync(
			this.#path,
			fs.constants.O_RDWR | fs.constants.O_CREAT
		);
		this.#flushQueue = [];
		this.#removeQueue = [];
		await this.#table.wal(Data.emptyData(), DatabaseMethod.Flush);
		this.#mutex.unlock();
	}

	async #retry<T>(
		fn: () => Promise<T>,
		maxRetries = 10,
		delay = 100
	): Promise<T> {
		try {
			return await fn();
		} catch (error) {
			if (this.#retries >= maxRetries) {
				this.#retries = 0;
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, delay));
			this.#retries++;
			return await this.#retry(fn, maxRetries, delay);
		}
	}

	async getAll(query?: (d: Data) => boolean): Promise<Data[]> {
		if (!query) query = () => true;
		await this.#mutex.lock();
		let json = JSON.parse(
			await fs.promises.readFile(this.#path, { encoding: "utf-8" })
		);
		const arr: Data[] = [];
		if (this.#table.db.options.encryptionConfig.encriptData) {
			const decryptedData = decrypt(
				json,
				this.#table.db.options.encryptionConfig.securityKey
			);
			json = JSON.parse(decryptedData);
		}
		for (const key in json) {
			if (query(json[key])) {
				const data = new Data({
					key: json[key].key,
					value: json[key].value,
					type: json[key].type,
					file: this.#path,
				});
				this.#cache.put(key, data);
				arr.push(data);
			}
		}
		this.#mutex.unlock();
		return arr;
	}

	async findOne(query?: (d: Data) => boolean): Promise<Data | undefined> {
		if (!query) query = () => true;
		const f = this.#cache.findOne(query);
		if (f) return f;
		await this.#mutex.lock();
		let json = JSON.parse(
			await fs.promises.readFile(this.#path, { encoding: "utf-8" })
		);
		this.#mutex.unlock();
		if (this.#table.db.options.encryptionConfig.encriptData) {
			const decryptedData = decrypt(
				json,
				this.#table.db.options.encryptionConfig.securityKey
			);
			json = JSON.parse(decryptedData);
		}
		for (const key in json) {
			if (query(json[key])) {
				const data = new Data({
					key: json[key].key,
					value: json[key].value,
					type: json[key].type,
					file: this.#path,
				});
				this.#cache.put(key, data);
				return data;
			}
		}
	}

	async remove(data: Data["key"]): Promise<void> {
		this.#removeQueue.push(data);
		this.#size--;
		this.#cache.remove(data);
	}

	async clear(): Promise<void> {
		this.#cache.clear();
		this.#size = 0;
		this.#flushQueue = [];
		this.#removeQueue = [];
		await ftruncate(this.#fd, 0);
		const buffer = Buffer.from("{}");
		await write(this.#fd, buffer, 0, buffer.length, 0);
	}

	async #has(key: string): Promise<boolean> {
		await this.#mutex.lock();
		let json = JSON.parse(
			await fs.promises.readFile(this.#path, { encoding: "utf-8" })
		);
		if (this.#table.db.options.encryptionConfig.encriptData) {
			const decryptedData = decrypt(
				json,
				this.#table.db.options.encryptionConfig.securityKey
			);
			json = JSON.parse(decryptedData);
		}
		this.#mutex.unlock();
		return !!json[key];
	}

	async has(key: string): Promise<boolean> {
		if (this.#cache.has(key)) return true;

		const idx = this.#flushQueue.findIndex((data) => data.key === key);
		if (idx !== -1) {
			return true;
		}

		if (this.#isDirty) {
			return false;
		}

		const value = await this.#has(key).catch((_) => false);
		return value ? true : false;
	}

	async removeMany(query: (d: Data) => boolean): Promise<void> {
		await this.#mutex.lock();
		let json = JSON.parse(
			await fs.promises.readFile(this.#path, { encoding: "utf-8" })
		);
		this.#mutex.unlock();
		if (this.#table.db.options.encryptionConfig.encriptData) {
			const decryptedData = decrypt(
				json,
				this.#table.db.options.encryptionConfig.securityKey
			);
			json = JSON.parse(decryptedData);
		}
		for (const key in json) {
			if (query(json[key])) {
				delete json[key];
			}
		}
		let writeData: string;
		if (this.#table.db.options.encryptionConfig.encriptData) {
			writeData = JSON.stringify(
				encrypt(
					JSON.stringify(json),
					this.#table.db.options.encryptionConfig.securityKey
				)
			);
		} else {
			writeData = JSON.stringify(json);
		}
		await this.#atomicWrite(writeData);
	}

	async #atomicWrite(data: string) {
		await this.#mutex.lock();
		const dir = path.dirname(this.#path);
		const opendir = await fs.promises.open(dir, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
		const tempFile = `${this.#path}.tmp`;
		const tmpfd = fs.openSync(
			tempFile,
			fs.constants.O_RDWR | fs.constants.O_CREAT
		);
		const buffer = Buffer.from(data);
		await write(tmpfd, buffer, 0, buffer.length, 0);
		await fsync(tmpfd);
		await close(tmpfd);
		await close(this.#fd);

		await this.#retry(
			async () =>
				{
					if(platform() === "win32") {
						await fs.promises.unlink(this.#path);
						await fs.promises.rename(tempFile, this.#path);
						this.#fd = await open(this.#path, fs.constants.O_RDWR | fs.constants.O_CREAT);
						await opendir.sync()
						await opendir.close()
					}
					else {
						await fs.promises.rename(tempFile, this.#path)
						this.#fd = await open(this.#path, fs.constants.O_RDWR | fs.constants.O_CREAT);
						await opendir.sync()
						await opendir.close()
					}
				},
			10,
			100
		);
		this.#fd = await open(
			this.#path,
			fs.constants.O_RDWR | fs.constants.O_CREAT
		);
		this.#mutex.unlock();
	}
	async ping() {
		const startTime = performance.now();
		await this.findOne(() => true);
		return performance.now() - startTime;
	}

	async unlink() {
		clearInterval(this.#interval);
		await fs.promises.unlink(this.#path);
	}

	async lockAndsync() {
		// remove interval
		clearInterval(this.#interval);
		await fsync(this.#fd);
	}

}
