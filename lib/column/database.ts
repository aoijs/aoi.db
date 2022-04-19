import { existsSync, mkdirSync } from "fs";
import { TypedEmitter } from "tiny-typed-emitter";
import { DatabaseEvents } from "../typings/enums.js";
import {
  ColumnDatabaseOptions,
  ColumnTableOptions,
  TypedDatabaseEvents,
} from "../typings/interface.js";
import {
  CacheReferenceType,
  WideColumnDataValueType,
} from "../typings/type.js";
import { WideColumnMemMap } from "./cacher.js";
import { WideColumnData } from "./data.js";
import { WideColumnError } from "./error.js";
import { WideColumnTable } from "./table.js";

export class WideColumn extends TypedEmitter<TypedDatabaseEvents> {
  tables: Map<string, WideColumnTable> = new Map();
  options: {
    cacheOption: {
      cacheReference: CacheReferenceType;
      limit: number;
      sorted: boolean;
    };
    extension: string;
    methodOption: {
      getTime: number;
      deleteTime: number;
    };
    path: string;
    storeOption: { maxDataPerFile: number };
    tables: ColumnTableOptions[];
    encryptOption: {
      securitykey: string;
    };
  };
  constructor(options: ColumnDatabaseOptions) {
    super();
    this.options = this._resolve(options);
  }
  _resolve(options: ColumnDatabaseOptions) {
    if (!options.encryptOption?.securitykey) {
      throw new WideColumnError("DB#encryptOption.securitykey is required.");
    }
    return {
      cacheOption: {
        cacheReference: options.cacheOption?.cacheReference ?? "MEMORY",
        limit: options.cacheOption?.limit ?? 5000,
        sorted: options.cacheOption?.sorted ?? true,
      },
      extension: options.extension ?? ".sql",
      methodOption: {
        getTime: options.methodOption?.getTime ?? 5000,
        deleteTime: options.methodOption?.deleteTime ?? 100,
      },
      path: options.path ?? "./database",
      storeOption: {
        maxDataPerFile: options.storeOption?.maxDataPerFile ?? 200,
      },
      tables: options.tables ?? [],
      encryptOption: {
        securitykey: options.encryptOption?.securitykey,
      },
    };
  }
  get securitykey() {
    return this.options.encryptOption.securitykey;
  }
  connect() {
    if (!existsSync(this.options.path))
      mkdirSync(this.options.path, { recursive: true });
    for (const table of this.options.tables) {
      const newTable = new WideColumnTable(table.name, table.columns, this);
      newTable.connect();
      this.tables.set(table.name, newTable);
    }
    this.emit(DatabaseEvents.READY);
  }
  async set(
    table: string,
    columnData: {
      name: string;
      value: WideColumnDataValueType;
    },
    primaryColumnData: {
      name: string;
      value: WideColumnDataValueType;
    },
  ) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    await tableObj.set(columnData, primaryColumnData);
  }
  async get(table: string, column: string, primary: WideColumnDataValueType) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    return await tableObj.get(column, primary);
  }
  async delete(
    table: string,
    column: string,
    primary: WideColumnDataValueType,
  ) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    await tableObj.delete(column, primary);
  }
  async all(
    table: string,
    column: string,
    filter: (
      value: WideColumnData,
      key?: WideColumnDataValueType,
      cacher?: WideColumnMemMap,
    ) => boolean,
    limit = 10,
  ) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    return await tableObj.all(column, filter, limit);
  }
  async getAllData(table: string, column: string) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    return await tableObj.getAllData(column);
  }
  get ping() {
    let ping = 0;
    for (const table of this.tables.values()) {
      ping += Number(table.ping);
    }
    return ping / this.tables.size;
  }
  tablePing(table: string) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    return tableObj.ping;
  }
  async getTransactionLog(table: string, column: string) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    return await tableObj.getTransactionLog(column);
  }
  async allData(table: string) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    return await tableObj.allData();
  }
  clearTable(table: string) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    tableObj.clear();
  }
  clearColumn(table: string, column: string) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    tableObj.clearColumn(column);
  }
  clear() {
    for (const table of this.tables.values()) {
      table.clear();
    }
  }
  disconnect() {
    for (const table of this.tables.values()) {
      table.disconnect();
    }
  }
  async bulkSet(
    table: string,
    ...data: [
      secondaryColumnData: {
        name: string;
        value: WideColumnDataValueType;
      },
      primaryColumnData: {
        name: string;
        value: WideColumnDataValueType;
      },
    ][]
  ) {
    const tableObj = this.tables.get(table);
    if (!tableObj) throw new WideColumnError(`Table ${table} not found`);
    await tableObj.bulkSet(...data);
  }
}
