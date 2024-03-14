import { PriorityQueue } from "@akarui/structures";
import Data from "./data.js";
import LRUCache from "./LRUcache.js";
import fs from "node:fs";
//@ts-ignore
import JSONStream from "JSONStream";
import { KeyValueJSONOption } from "../typings/interface.js";
import Table from "./Table.js";
import { decrypt, encrypt } from "../../utils.js";

export default class File {
  #cache: LRUCache;
  #path: string;
  #fd!: fs.promises.FileHandle;
  #size: number;
  #isDirty: boolean;
  #locked: boolean;
  #flushQueue: Data[];
  #removeQueue: Data["key"][];
  #interval!: NodeJS.Timeout;
  #table: Table;
  constructor(path: string, capacity: number, table: Table) {
    this.#cache = new LRUCache(capacity);
    this.#path = path;
    this.#table = table;
    this.#size = 0;
    this.#isDirty = false;
    this.#locked = false;
    this.#flushQueue = [];
    this.#removeQueue = [];

    // Open file
    fs.promises
      .open(this.#path, fs.constants.O_RDWR | fs.constants.O_CREAT)
      .then(async (fd) => {
        this.#fd = fd;
        await this.#checkIntegrity();
        this.#enableInterval();
      })
      .catch((e) => {
        throw e;
      });
  }

  get name() {
    return this.#path.split("/").pop()!.split(".")[0];
  }

  #enableInterval() {
    if (this.#isDirty) return;
    this.#interval = setInterval(async () => {
      if (this.#flushQueue.length === 0) {
        return;
      }
      if (this.#locked) {
        return;
      }
      this.#locked = true;
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
    return this.#locked;
  }

  get flushQueue() {
    return this.#flushQueue;
  }

  get interval() {
    return this.#interval;
  }

  async #checkIntegrity() {
    await new Promise<void>((resolve, reject) => {
      try {
        const jsonstream = JSONStream.parse("*");
        this.#fd.createReadStream().pipe(jsonstream);
        jsonstream.on("data", (data: KeyValueJSONOption) => {
          this.#size++;
          this.#cache.put(
            data.key,
            new Data({
              key: data.key,
              value: data.value,
              type: data.type,
              file: this.#path,
            })
          );
        });

        jsonstream.on("end", () => {
          resolve();
        });
      } catch (e) {
        this.#isDirty = true;
        reject(e);
      }
    });
  }

  async get(key: string): Promise<Data | undefined> {
    const idx = this.#flushQueue.findIndex((data) => data.key === key);

    if (idx !== -1) {
      return this.#flushQueue[idx];
    }

    if (this.#cache.has(key)) {
      return this.#cache.get(key);
    }

    if (this.#isDirty) {
      return;
    }

    if (this.#locked) {
      setTimeout(() => this.get(key), 100);
    }

    this.#locked = true;
    const value = await this.#getFromDisk(key);
    this.#locked = false;
    return value;
  }

  async #getFromDisk(key: string): Promise<Data | undefined> {
    return await new Promise<Data>((resolve, reject) => {
      const jsonstream = JSONStream.parse("*");
      this.#fd.createReadStream().pipe(jsonstream);
      let value: Data;
      jsonstream.on("data", (data: KeyValueJSONOption) => {
        if (data.key === key) {
          value = new Data({
            key: data.key,
            value: data.value,
            type: data.type,
            file: this.#path,
          });
          this.#cache.put(data.key, value);
          jsonstream.end();
        }
      });

      jsonstream.on("end", () => {
        this.#locked = false;
        resolve(value);
      });

      jsonstream.on("error", (e: any) => {
        this.#locked = false;
        reject(e);
      });
    });
  }

  async put(key: string, value: Data): Promise<void> {
    this.#cache.put(key, value);
    this.#size++;
    this.#flushQueue.push(value);
  }

  async #atomicFlush() {
    const tempFile = `${this.#path}.tmp`;
    const fd = await fs.promises.open(
      tempFile,
      fs.constants.O_RDWR | fs.constants.O_CREAT
    );
    let json = JSON.parse(await this.#fd.readFile({ encoding: "utf-8" }));
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

    await fd.writeFile(writeData);
    await this.#fd.close();
    await fs.promises.rename(tempFile, this.#path);
    this.#fd = await fs.promises.open(
      this.#path,
      fs.constants.O_RDWR | fs.constants.O_CREAT
    );
    this.#flushQueue = [];
    this.#removeQueue = [];
    this.#locked = false;
  }

  async getAll(query?: (d: Data) => boolean): Promise<Data[]> {
    if (!query) query = () => true;
    let json = JSON.parse(await this.#fd.readFile({ encoding: "utf-8" }));
    const arr: Data[] = [];
    if (this.#table.db.options.encryptionConfig.encriptData) {
      const decryptedData = decrypt(
        json,
        this.#table.db.options.encryptionConfig.securityKey
      );
      json = JSON.parse(decryptedData);
    }
    for (const key in json) {
      if (query(json[key])) arr.push(json[key]);
    }
    return arr;
  }

  async findOne(query?: (d: Data) => boolean): Promise<Data | undefined> {
    if (!query) query = () => true;
    let json = JSON.parse(await this.#fd.readFile({ encoding: "utf-8" }));
    if (this.#table.db.options.encryptionConfig.encriptData) {
      const decryptedData = decrypt(
        json,
        this.#table.db.options.encryptionConfig.securityKey
      );
      json = JSON.parse(decryptedData);
    }
    for (const key in json) {
      if (query(json[key])) return json[key];
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
    await this.#fd.truncate(0);
    const buffer = Buffer.from("{}");
    await this.#fd.write(buffer, 0, buffer.length, 0);
  }

  async #has(key: string): Promise<boolean> {
    const jsonStream = JSONStream.parse("*.key");
    this.#fd.createReadStream().pipe(jsonStream);
    return new Promise<boolean>((resolve, reject) => {
      let found = false;
      jsonStream.on("data", (data: KeyValueJSONOption) => {
        if (data.key === key) {
          resolve(true);
          found = true;
          jsonStream.end();
        }
      });

      jsonStream.on("end", () => {
        if (!found) resolve(false);
      });

      jsonStream.on("error", (e: any) => {
        reject(e);
      });
    });
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

    if (this.#locked) {
      setTimeout(() => this.has(key), 100);
    }

    this.#locked = true;
    const value = await this.#has(key).catch((_) => false);
    this.#locked = false;
    return value ? true : false;
  }

  async removeMany(query: (d: Data) => boolean): Promise<void> {
    let json = JSON.parse(await this.#fd.readFile({ encoding: "utf-8" }));
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
    const f = () => {
      if (this.#locked) setTimeout(() => f(), 100);
      else this.#fd.writeFile(writeData);
    };
    if (this.#locked)
      setTimeout(() => {
        if (this.#locked) setTimeout(() => f(), 100);
        else this.#fd.writeFile(writeData);
      }, 100);
    else await this.#atomicWrite(writeData);
  }

  async #atomicWrite(data: string) {
    this.#locked = true;
    const tempFile = `${this.#path}.tmp`;
    const fd = await fs.promises.open(
      tempFile,
      fs.constants.O_RDWR | fs.constants.O_CREAT
    );
    await fd.writeFile(data);
    await this.#fd.close();

    await fs.promises.rename(tempFile, this.#path);
    this.#fd = await fs.promises.open(
      this.#path,
      fs.constants.O_RDWR | fs.constants.O_CREAT
    );
    this.#locked = false;
  }
  async ping() {
    const startTime = performance.now();
    await this.findOne(() => true);
    return performance.now() - startTime;
  }
}
