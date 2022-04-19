import { existsSync, mkdirSync, writeFileSync } from "fs";
import { TypedEmitter } from "tiny-typed-emitter";
import { DatabaseEvents } from "../typings/enums.js";
import {
  KeyValueDatabaseOption,
  KeyValueDataOption,
  TypedDatabaseEvents,
} from "../typings/interface.js";
import { CacheReferenceType } from "../typings/type.js";
import { KeyValueError } from "./error.js";
import { Table } from "./table.js";
export class KeyValue extends TypedEmitter<TypedDatabaseEvents> {
  tables: Map<string, Table> = new Map<string, Table>();
  options: {
    path: string;
    extension: string;
    tables: string[];
    cacheOption: {
      cacheReference: CacheReferenceType;
      limit: number;
      sorted: boolean;
    };
    encryptOption: { enabled: boolean; securitykey: string };
    methodOption: {
      allTime: number;
      deleteTime: number;
      getTime: number;
      saveTime: number;
    };
    storeOption: { maxDataPerFile: number };
  };
  ready: boolean = false;
  readyTimestamp: number = -1;

  constructor(options: KeyValueDatabaseOption) {
    super();
    this.options = this._resolve(options);
  }
  _resolve(options: KeyValueDatabaseOption) {
    return {
      path: options.path ?? "./database",
      extension: options.extension ?? ".sql",
      tables: options.tables ?? ["main"],
      cacheOption: {
        cacheReference: options.cacheOption?.cacheReference ?? "MEMORY",
        limit: 10000,
        sortOrder: options.cacheOption?.sortOrder ?? "DESC",
        sorted: options.cacheOption?.sorted ?? false,
      },
      encryptOption: {
        enabled: options.encryptOption?.enabled ?? false,
        securitykey: options.encryptOption?.securitykey ?? "",
      },
      methodOption: {
        allTime: options.methodOption?.allTime ?? 10000,
        deleteTime: options.methodOption?.deleteTime ?? 500,
        getTime: options.methodOption?.getTime ?? 1000,
        saveTime: options.methodOption?.saveTime ?? 100,
      },
      storeOption: {
        maxDataPerFile: options.storeOption?.maxDataPerFile ?? 10000,
      },
    };
  }
  connect() {
    if (!existsSync(this.options.path)) {
      mkdirSync(this.options.path, {
        recursive: true,
      });
    }
    for (const table of this.options.tables) {
      if (!existsSync(`${this.options.path}/${table}`)) {
        mkdirSync(`${this.options.path}/${table}`);
        writeFileSync(
          `${this.options.path}/${table}/${table}_scheme_1${this.options.extension}`,
          "{}",
        );
        this._debug("CREATE_TABLE", `Created table ${table}`);
      }
      const newtable = new Table(table, `${this.options.path}/${table}`, this);
      newtable.connect();
      this.tables.set(table, newtable);
    }
    this.ready = true;
    this.readyTimestamp = Date.now();
    this.emit(DatabaseEvents.READY);
  }
  async set(table: string, key: string, value: KeyValueDataOption) {
    const tableClass = this.tables.get(table);
    if (!tableClass) {
      throw new KeyValueError(`[InvalidTable] :  Table ${table} not found!`);
    }
    return await tableClass.set(key, value);
  }
  async get(table: string, key: string) {
    const tableClass = this.tables.get(table);
    if (!tableClass) {
      throw new KeyValueError(`[InvalidTable] :  Table ${table} not found!`);
    }
    return await tableClass.get(key);
  }
  async delete(table: string, key: string) {
    const tableClass = this.tables.get(table);
    if (!tableClass) {
      throw new KeyValueError(`[InvalidTable] :  Table ${table} not found!`);
    }
    return await tableClass.delete(key);
  }
  clear(table: string) {
    const tableClass = this.tables.get(table);
    if (!tableClass) {
      throw new KeyValueError(`[InvalidTable] :  Table ${table} not found!`);
    }
    return tableClass.clear();
  }
  async all(
    table: string,
    filter?: (key?: string) => boolean,
    limit = 10,
    sortType: "asc" | "desc" = "desc",
  ) {
    const tableClass = this.tables.get(table);
    if (!tableClass) {
      throw new KeyValueError(`[InvalidTable] :  Table ${table} not found!`);
    }
    return await tableClass.all(filter, limit, sortType);
  }
  get ping() {
    const res: number[] = [];
    this.tables.forEach((table) => {
      res.push(table.getPing());
    });
    return res.reduce((a, b) => a + b) / this.tables.size;
  }
  tablePing(table: string) {
    const tableClass = this.tables.get(table);
    if (!tableClass) {
      throw new KeyValueError(`[InvalidTable] :  Table ${table} not found!`);
    }
    return tableClass.getPing();
  }
  _debug(header: string, msg: string) {
    this.emit("debug", `[KeyValue](${header}) => ${msg}`);
  }
  async bulkSet(
    table: string,
    ...data: { key: string; options: KeyValueDataOption }[]
  ) {
    const tableClass = this.tables.get(table);
    if (!tableClass) {
      throw new KeyValueError(`[InvalidTable] :  Table ${table} not found!`);
    }
    return await tableClass.setMultiple(...data);
  }
  disconnect() {
    this.tables.clear();
    this.ready = false;
    this.readyTimestamp = -1;
    this.emit(DatabaseEvents.DISCONNECT);
  }
}
