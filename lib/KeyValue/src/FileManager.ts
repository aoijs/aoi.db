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
    const filesCount = readdirSync(table.paths.table).length;
    this.#hashSize = Math.max(hashSize, filesCount);

    this.#table = table;
  }

  initialize() {
    this.#array = Array.from({ length: this.#hashSize }, (_, i: number) => {
      return new File(
        `${this.#table.paths.table}/${this.#table.options.name}_scheme_${i}${
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
    const hash = crypto.createHash("sha256");
    hash.update(key);
    return hash.digest("hex");
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
    const newArraySize = this.#hashSize * 2;
    const newArray = Array.from({ length: newArraySize }, (_, i: number) => {
      return new File(
        `${this.#table.paths.table}/${this.#table.options.name}_scheme_${i}${
          this.#table.db.options.fileConfig.extension
        }`,
        this.#table.db.options.fileConfig.maxSize / 4,
        this.#table
      );
    });

    for (const file of this.#array) {
      const data = await file.getAll();
      for (const value of data) {
        const hash = this.#hash(value.key);
        const index = this.#getHashIndex(hash);
        newArray[index].put(value.key, value);
      }
    }
    this.#array = newArray;
    this.#hashSize = newArraySize;
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
    const data: Data[] = [];
    if (order === "firstN") {
      for (const file of this.#array) {
        const d = await file.getAll(query);
        data.concat(d);
        if (data.length == limit) return data;
        else if (data.length > limit) return data.slice(0, limit);
      }
      return data;
    } else {
      for (const file of this.#array) {
        const d = await file.getAll(query);
        data.concat(d);
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
      data.concat(d);
    }
    return data;
  }

  async getFirstN(query: (d: KeyValueData) => boolean, limit: number) {
    const data: Data[] = [];
    for (const file of this.#array) {
      const d = await file.getAll(query);
      data.concat(d);
      if (data.length == limit) return data;
      else if (data.length > limit) return data.slice(0, limit);
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
