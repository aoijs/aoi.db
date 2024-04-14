import crypto from "node:crypto";
import { KeyValueData } from "../index.js";
import Table from "./Table.js";
import File from "./File.js";
import { readdirSync } from "node:fs";
import Data from "./data.js";

export default class FileManager {
	#maxSize: number;
	#hashSize: number;
	#array!: File[];
	#table: Table;
	constructor(maxSize: number, hashSize = 20, table: Table) {
		this.#maxSize = maxSize;
		this.#hashSize = hashSize;

		this.#table = table;
	}

	initialize() {
		const filesCount = readdirSync(this.#table.paths.table).length;
		this.#hashSize = Math.max(this.#hashSize, filesCount);
		this.#array = Array.from({ length: this.#hashSize }, (_, i: number) => {
			return new File(
				`${this.#table.paths.table}/${
					this.#table.options.name
				}_scheme_${i + 1}${
					this.#table.db.options.fileConfig.extension
				}`,
				this.#table.db.options.fileConfig.maxSize / 4,
				this.#table
			);
		});

		if (this.#table.db.options.fileConfig.reHashOnStartup) {
			this.#rehash();
		}
	}

	get maxHashArraySize() {
		return this.#maxSize;
	}

	get hashSize() {
		return this.#hashSize;
	}

	#hash(key: string) {
		const hash = key.split("").reduce((a, b) => {
			a += b.charCodeAt(0);
			return a & a;
		}, 1);
		return hash.toString(16);
	}

	add(data: KeyValueData) {
		const hash = this.#hash(data.key);
		const index = this.#getHashIndex(hash);
		data.file = this.#array[index].name;
		this.#array[index].put(data.key, data);
		if (this.#array[index].size > this.#maxSize) {
			this.#rehash();
		}
	}
	#getHashIndex(hash: string) {
		const hashValue = parseInt(hash, 16);
		return hashValue % this.#hashSize;
	}

	async #rehash() {
		const datas = [];
		for (const file of this.#array) {
			const data = await file.getAll();
			for (const value of data) {
				datas.push(value);
			}
		}

		// clear all files
		for (const file of this.#array) {
			await file.unlink();
		}

		const relativeSize = datas.length / this.#maxSize;
		const newArraySize = 10*(relativeSize+1);
		this.#hashSize = newArraySize;
		const newArray = Array.from(
			{ length: newArraySize },
			(_, i: number) => {
				return new File(
					`${this.#table.paths.table}/${
						this.#table.options.name
					}_scheme_${i + 1}${
						this.#table.db.options.fileConfig.extension
					}`,
					this.#maxSize / 4,
					this.#table
				);
			}
		);

		for (const data of datas) {
			const hash = this.#hash(data.key);
			const index = this.#getHashIndex(hash);
			data.file = newArray[index].name;
			await newArray[index].put(data.key, data);
		}

		this.#array = newArray;
	}

	remove(data: KeyValueData["key"]) {
		const hash = this.#hash(data);
		const index = this.#getHashIndex(hash);
		this.#array[index].remove(data);
	}

	get(key: KeyValueData["key"]) {
		const hash = this.#hash(key);
		const index = this.#getHashIndex(hash);
		return this.#array[index].get(key);
	}

	clear() {
		for (const file of this.#array) {
			file.clear();
		}
	}

	has(key: KeyValueData["key"]) {
		const hash = this.#hash(key);
		const index = this.#getHashIndex(hash);
		return this.#array[index].has(key);
	}

	async all(
		query: (d: KeyValueData) => boolean,
		limit: number,
		order: "firstN" | "asc" | "desc"
	) {
		if (order === "firstN") {
			const data: Set<Data> = new Set();
			for (const file of this.#array) {
				for (const value of file.cache.all()) {
					data.add(value);
					if (data.size === limit) return Array.from(data);
				}
			}

			for (const file of this.#array) {
				const d = await file.getAll(query);
				for (const value of d) {
					data.add(value);
					if (data.size == limit) return Array.from(data);
				}
			}
			return Array.from(data);
		} else {
			const data: Data[] = [];
			for (const file of this.#array) {
				const d = await file.getAll(query);
				for (const value of d) {
					data.push(value);
				}
			}
			if (order === "asc") {
				data.sort((a, b) => a.key.localeCompare(b.key));
			} else {
				data.sort((a, b) => b.key.localeCompare(a.key));
			}
			return data.slice(0, limit);
		}
	}

	async findOne(query: (d: KeyValueData) => boolean) {
		for (const file of this.#array) {
			const d = await file.findOne(query);
			if (d) return d;
		}
	}

	async findMany(query: (d: KeyValueData) => boolean) {
		const data: Data[] = [];
		for (const file of this.#array) {
			const d = await file.getAll(query);
			for (const value of d) {
				data.push(value);
			}
		}
		return data;
	}

	async getFirstN(query: (d: KeyValueData) => boolean, limit: number) {
		const data: Data[] = [];
		for (const file of this.#array) {
			const d = await file.getAll(query);
			for (const value of d) {
				data.push(value);
				if (data.length == limit) return data;
			}
		}
		return data;
	}

	async removeMany(query: (d: KeyValueData) => boolean) {
		for (const file of this.#array) {
			await file.removeMany(query);
		}
	}

	async ping() {
		let sum = 0;
		for (const file of this.#array) {
			sum += await file.ping();
		}
		return sum / this.#hashSize;
	}
}
