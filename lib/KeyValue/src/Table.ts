import EventEmitter from "node:events";
import { KeyValueTableOptions, LogBlock } from "../typings/interface.js";
import KeyValue from "./database.js";
import FileManager from "./FileManager.js";
import fs from "node:fs";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import {
  createHash,
  createHashRawString,
  decodeHash,
  stringify,
} from "../../utils.js";
import { KeyValueDataValueType, KeyValueTypeList } from "../typings/type.js";
import Data from "./data.js";
import { createInterface } from "node:readline/promises";
import { ftruncate, write } from "../../promisifiers.js";
import { setTimeout } from "node:timers/promises";

export default class Table extends EventEmitter {
  #options: KeyValueTableOptions;
  #db: KeyValue;
  #fileManager: FileManager;
  locked: boolean = false;
  isFlushing: boolean = false;
  paths!: {
    log: string;
    table: string;
  };
  logData!: {
    fd: number;
    size: number;
    fileSize: number;
    logIV: string;
  };
  readyAt: number = -1;

  constructor(options: KeyValueTableOptions, db: KeyValue) {
    super();
    this.#options = options;
    this.#db = db;
    this.#fileManager = new FileManager(
      db.options.fileConfig.maxSize,
      db.options.fileConfig.minFileCount,
      this
    );
  }

  get options() {
    return this.#options;
  }

  get db() {
    return this.#db;
  }

  get fileManager() {
    return this.#fileManager;
  }

  async initialize() {
    this.#getPaths();
    this.#fileManager.initialize();
    await this.#getLogData();
    await setTimeout(100);
    await this.#syncWithLog();
    this.readyAt = Date.now();
    this.#db.emit(DatabaseEvents.TableReady, this);
  }

  async #getPaths() {
    const { path } = this.#db.options.dataConfig;
    const { transactionLogPath } = this.#db.options.fileConfig;

    const { name } = this.#options;
    this.paths = {
      log: `${transactionLogPath}/${name}/transaction.log`,
      table: `${path}/${name}`,
    };
  }

  async #getLogData() {
    let size = 0;
    let logIV = "";
    const stream = fs.createReadStream(this.paths.log, {
      encoding: "utf-8",
      highWaterMark: 33,
    });
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      size++;
      if (size === 1) {
        logIV = line;
      }
    }

    this.logData = {
      fd: fs.openSync(this.paths.log, "a+"),
      size,
      fileSize: fs.statSync(this.paths.log).size,
      logIV,
    };

  }

  async getLogs() {
    const logs: LogBlock[] = [];
    let ignoreFirstLine = true;
    const { securityKey } = this.#db.options.encryptionConfig;
    const stream = fs.createReadStream(this.paths.log, {
      encoding: "utf-8",
    })
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      if (ignoreFirstLine) ignoreFirstLine = false;
      else {
        const [key, value, type, ttl, method] = decodeHash(
          line,
          securityKey,
          this.logData.logIV
        );
        let parsedMethod: DatabaseMethod;
        if (!method) parsedMethod = Number(ttl);
        else parsedMethod = Number(method);

        logs.push({
          key,
          value,
          type: type as KeyValueTypeList,
          method: parsedMethod,
        });
      }
    }
    return logs;
  }

  async #syncWithLog() {
    const logs = await this.getLogs();
    const lastFlushIndex = logs.findLastIndex(
      (log) => log.method === DatabaseMethod.Flush
    );

    const startIndex = lastFlushIndex === -1 ? 0 : lastFlushIndex + 1;
    for (let i = startIndex; i < logs.length; i++) {
      const log = logs[i];

      if (log.method === DatabaseMethod.Set) {
        const data = new Data({
          key: log.key,
          value: log.value,
          type: log.type,
          file: "",
        });

        this.#fileManager.add(data);
      } else if (log.method === DatabaseMethod.Delete) {
        this.#fileManager.remove(log.key);
      }
    }

    await this.#wal(Data.emptyData(), DatabaseMethod.Flush);
  }

  async #wal(data: Data, method: DatabaseMethod) {
    return new Promise<void>(async (resolve) => {
      const { key, type, value } = data.toJSON();
      const { securityKey } = this.#db.options.encryptionConfig;

      const delimitedString = createHashRawString([
        key,
        stringify(value),
        type,
        method.toString(),
      ]);

      const logHash = createHash(
        delimitedString,
        securityKey,
        this.logData.logIV
      );

      const {bytesWritten} =  await write(this.logData.fd, logHash + "\n", this.logData.fileSize, "utf-8");
      this.logData.fileSize += bytesWritten;
      this.logData.size++;

      if (
        method === DatabaseMethod.Flush &&
        this.logData.size > this.#db.options.fileConfig.maxSize
      ) {
        await ftruncate(this.logData.fd, 33);
      }
      resolve();
      return;
    });
  }

  async set(key:string,value:KeyValueDataValueType, type?: KeyValueTypeList) {
    const data = new Data({ key, value, type,file: "" });
    this.#fileManager.add(data);
    await this.#wal(data, DatabaseMethod.Set);
  }

  async get(key: string) {
    return this.#fileManager.get(key);
  }

  async delete(key: string) {
    this.#fileManager.remove(key);
    await this.#wal(Data.emptyData(), DatabaseMethod.Delete);
  }

  async clear() {
    this.#fileManager.clear();
    await this.#wal(Data.emptyData(), DatabaseMethod.Clear);
  }

  async has(key: string) {
    return this.#fileManager.has(key);
  }

  async all(query: (d:Data) => boolean,limit: number, order: "firstN" | "asc" | "desc") {
    return this.#fileManager.all(query,limit, order);
  }

  async findOne(query: (d:Data) => boolean) {
    return this.#fileManager.findOne(query);
  }

  async findMany(query: (d:Data) => boolean) {
    return this.#fileManager.findMany(query);
  }
  async removeMany(query: (d:Data) => boolean) {
    return this.#fileManager.removeMany(query);
  }
  async ping() {
    return this.#fileManager.ping();
  }
}
