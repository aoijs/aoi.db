import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumnMemMap } from "../../column/cacher.js";
import { WideColumnData } from "../../column/data.js";
import { Cacher } from "../../keyvalue/cacher.js";
import { Data } from "../../keyvalue/data.js";
import { ReceiverOp, WsEventsList as TransmitterEvents, TransmitterOp, WsDBTypes, TransmitterDBTypes, } from "../../typings/enums.js";
import { parseData } from "../../utils/functions.js";
export class Transmitter extends TypedEmitter {
    #name;
    #pass;
    connection;
    cache;
    options;
    _ping = -1;
    lastPingTimestamp = -1;
    sequence = 0;
    databaseType;
    pingTimeout;
    #dbOptions;
    constructor(options) {
        super();
        this.connection = new ws(options.path, options.wsOptions);
        this.options = options;
        this.#name = options.name;
        this.#pass = options.pass;
        this.#dbOptions = options.dbOptions;
        this.databaseType = options.databaseType;
    }
    connect() {
        this.connection.on("open", () => {
            this.#heartbeat();
            this.emit(TransmitterEvents.OPEN);
            this.connection.send(JSON.stringify({
                op: TransmitterOp.REQUEST,
                d: {
                    options: this.#dbOptions,
                    name: this.#name,
                    pass: this.#pass,
                    dbType: WsDBTypes[this.databaseType],
                },
            }));
        });
        this.connection.on("ping", () => {
            this.#heartbeat();
        });
        this.connection.on("message", (data) => {
            const parsedData = JSON.parse(data);
            this.emit(TransmitterEvents.MESSAGE, parsedData);
            if (parsedData.op === ReceiverOp.ACK_CONNECTION) {
                this.emit(TransmitterEvents.CONNECT);
                this.databaseType = TransmitterDBTypes[parsedData.db];
                const sendData = {
                    op: TransmitterOp.BULK_TABLE_OPEN,
                    d: {
                        tables: this.options.tables,
                        flags: this.options.flags,
                    },
                };
                this.connection.send(JSON.stringify(sendData));
            }
            else if (parsedData.op === ReceiverOp.ACK_TABLES) {
                const sendData = {
                    op: TransmitterOp.PING,
                };
                this.connection.send(JSON.stringify(sendData));
                this.lastPingTimestamp = Date.now();
                setInterval(() => {
                    const sendData = {
                        op: TransmitterOp.PING,
                    };
                    this.connection.send(JSON.stringify(sendData));
                    this.lastPingTimestamp = Date.now();
                }, 41250);
            }
            else if (parsedData.op === ReceiverOp.ACK_PING) {
                this._ping = Date.now() - this.lastPingTimestamp;
            }
            else if (parsedData.op === ReceiverOp.ACK_CACHE) {
                if (this.databaseType === "KeyValue") {
                    const cache = new Cacher(this.options.cacheOption ?? { limit: 10000 });
                    this.cache = cache;
                    parsedData.d.forEach((x) => {
                        this.cache?.set(x.key, 
                        // @ts-ignore
                        new Data({
                            value: x.value,
                            file: x.file,
                            type: x.type,
                            ttl: x.ttl,
                            key: x.key,
                        }));
                    });
                }
                else {
                    const cache = new Map();
                    parsedData.d.forEach((x) => {
                        if (cache.get(x.primaryColumnValue)) {
                            if (!cache.get(x.primaryColumnValue)?.get(x.secondaryColumnValue)) {
                                cache.get(x.primaryColumnValue)?.set(x.secondaryColumnValue, new WideColumnData({
                                    primaryColumnName: x.primaryColumnName,
                                    primaryColumnValue: x.primaryColumnValue,
                                    secondaryColumnName: x.secondaryColumnName,
                                    secondaryColumnValue: x.secondaryColumnValue,
                                    primaryColumnType: x.primaryColumnType,
                                    secondaryColumnType: x.secondaryColumnType,
                                }));
                            }
                        }
                        cache?.set(x.primaryColumnName, new WideColumnMemMap(this.options.cacheOption ?? { limit: 10000 }));
                        cache?.get(x.primaryColumnName)?.set(x.secondaryColumnValue, new WideColumnData({
                            primaryColumnName: x.primaryColumnName,
                            primaryColumnValue: x.primaryColumnValue,
                            secondaryColumnName: x.secondaryColumnName,
                            secondaryColumnValue: x.secondaryColumnValue,
                            primaryColumnType: x.primaryColumnType,
                            secondaryColumnType: x.secondaryColumnType,
                        }));
                    });
                }
            }
        });
        this.connection.on("close", (code, reason) => {
            this.#clearPingTimeout();
            this.emit(TransmitterEvents.CLOSE, code, reason);
        });
        this.connection.on("error", (err) => {
            this.emit(TransmitterEvents.ERROR, err);
        });
    }
    async _set(table, key, data) {
        const start = performance.now();
        const stringifiedData = parseData(data, WsDBTypes[this.databaseType]);
        const sendData = {
            op: TransmitterOp.SET,
            d: {
                table,
                key,
                data: stringifiedData,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === ReceiverOp.ACK_SET) {
                    resolve({
                        o: performance.now() - start,
                        ...parsedData,
                    });
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    async _get(table, key, id) {
        const start = performance.now();
        const sendData = {
            op: TransmitterOp.GET,
            d: {
                table,
                key,
                primary: id,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === ReceiverOp.ACK_GET) {
                    resolve({ o: performance.now() - start, ...parsedData });
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    async _delete(table, key, primary) {
        const start = performance.now();
        const sendData = {
            op: TransmitterOp.DELETE,
            d: {
                table,
                key,
                primary,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === ReceiverOp.ACK_DELETE) {
                    resolve({
                        o: performance.now() - start,
                        ...parsedData,
                    });
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    async _all(table, { filter, limit, column, sortOrder, } = {}) {
        const start = performance.now();
        const sendData = {
            op: TransmitterOp.ALL,
            d: {
                table,
                filter,
                limit,
                column,
                sortOrder,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === ReceiverOp.ACK_ALL) {
                    resolve({
                        o: performance.now() - start,
                        ...parsedData,
                    });
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    async _clear(table, column) {
        const start = performance.now();
        const sendData = {
            op: TransmitterOp.CLEAR,
            d: {
                table,
                column,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === ReceiverOp.ACK_CLEAR) {
                    resolve({
                        o: performance.now() - start,
                        ...parsedData,
                    });
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    get ping() {
        return this._ping;
    }
    #heartbeat() {
        if (this.pingTimeout)
            clearTimeout(this.pingTimeout);
        this.pingTimeout = setTimeout(() => {
            console.log("cleared");
            this.connection.terminate();
        }, 60000);
    }
    #clearPingTimeout() {
        clearTimeout(this.pingTimeout);
    }
    async analyze(method, data) {
        if (method === "set") {
            return await this._set(data.table, data.key, data.data);
        }
        else if (method === "get") {
            return await this._get(data.table, data.key, data.id);
        }
        else if (method === "all") {
            return await this._all(data.table, data);
        }
        else if (method === "delete") {
            return await this._delete(data.table, data.key, data.primary);
        }
        else if (method === "clear") {
            return await this.clear(data.table, data.column);
        }
        else {
            throw new Error("Invalid method");
        }
    }
    async set(table, key, data) {
        return (await this._set(table, key, data)).d;
    }
    async get(table, key, id) {
        return (await this._get(table, key, id)).d;
    }
    async delete(table, key, primary) {
        return (await this._delete(table, key, primary)).d;
    }
    async all(table, { filter, limit, column, sortOrder, } = {}) {
        return (await this._all(table, { filter, limit, column, sortOrder })).d;
    }
    async clear(table, column) {
        return (await this._clear(table, column)).d;
    }
}
//# sourceMappingURL=database.js.map