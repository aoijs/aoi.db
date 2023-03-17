"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transmitter = void 0;
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const ws_1 = __importDefault(require("ws"));
const cacher_js_1 = require("../../column/cacher.js");
const data_js_1 = require("../../column/data.js");
const cacher_js_2 = require("../../keyvalue/cacher.js");
const data_js_2 = require("../../keyvalue/data.js");
const enums_js_1 = require("../../typings/enums.js");
const functions_js_1 = require("../../utils/functions.js");
class Transmitter extends tiny_typed_emitter_1.TypedEmitter {
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
        this.connection = new ws_1.default(options.path, options.wsOptions);
        this.options = options;
        this.#name = options.name;
        this.#pass = options.pass;
        this.#dbOptions = options.dbOptions;
        this.databaseType = options.databaseType;
    }
    connect() {
        this.connection.on("open", () => {
            this.#heartbeat();
            this.emit(enums_js_1.WsEventsList.OPEN);
            this.connection.send(JSON.stringify({
                op: enums_js_1.TransmitterOp.REQUEST,
                d: {
                    options: this.#dbOptions,
                    name: this.#name,
                    pass: this.#pass,
                    dbType: enums_js_1.WsDBTypes[this.databaseType],
                },
            }));
        });
        this.connection.on("ping", () => {
            this.#heartbeat();
        });
        this.connection.on("message", (data) => {
            const parsedData = JSON.parse(data);
            this.emit(enums_js_1.WsEventsList.MESSAGE, parsedData);
            if (parsedData.op === enums_js_1.ReceiverOp.ACK_CONNECTION) {
                this.emit(enums_js_1.WsEventsList.CONNECT);
                this.databaseType = enums_js_1.TransmitterDBTypes[parsedData.db];
                const sendData = {
                    op: enums_js_1.TransmitterOp.BULK_TABLE_OPEN,
                    d: {
                        tables: this.options.tables,
                        flags: this.options.flags,
                    },
                };
                this.connection.send(JSON.stringify(sendData));
            }
            else if (parsedData.op === enums_js_1.ReceiverOp.ACK_TABLES) {
                const sendData = {
                    op: enums_js_1.TransmitterOp.PING,
                };
                this.connection.send(JSON.stringify(sendData));
                this.lastPingTimestamp = Date.now();
                setInterval(() => {
                    const sendData = {
                        op: enums_js_1.TransmitterOp.PING,
                    };
                    this.connection.send(JSON.stringify(sendData));
                    this.lastPingTimestamp = Date.now();
                }, 41250);
            }
            else if (parsedData.op === enums_js_1.ReceiverOp.ACK_PING) {
                this._ping = Date.now() - this.lastPingTimestamp;
            }
            else if (parsedData.op === enums_js_1.ReceiverOp.ACK_CACHE) {
                if (this.databaseType === "KeyValue") {
                    const cache = new cacher_js_2.Cacher(this.options.cacheOption ?? { limit: 10000 });
                    this.cache = cache;
                    parsedData.d.forEach((x) => {
                        this.cache?.set(x.key, 
                        // @ts-ignore
                        new data_js_2.Data({
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
                                cache.get(x.primaryColumnValue)?.set(x.secondaryColumnValue, new data_js_1.WideColumnData({
                                    primaryColumnName: x.primaryColumnName,
                                    primaryColumnValue: x.primaryColumnValue,
                                    secondaryColumnName: x.secondaryColumnName,
                                    secondaryColumnValue: x.secondaryColumnValue,
                                    primaryColumnType: x.primaryColumnType,
                                    secondaryColumnType: x.secondaryColumnType,
                                }));
                            }
                        }
                        cache?.set(x.primaryColumnName, new cacher_js_1.WideColumnMemMap(this.options.cacheOption ?? { limit: 10000 }));
                        cache?.get(x.primaryColumnName)?.set(x.secondaryColumnValue, new data_js_1.WideColumnData({
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
            this.emit(enums_js_1.WsEventsList.CLOSE, code, reason);
        });
        this.connection.on("error", (err) => {
            this.emit(enums_js_1.WsEventsList.ERROR, err);
        });
    }
    async _set(table, key, data) {
        const start = performance.now();
        const stringifiedData = (0, functions_js_1.parseData)(data, enums_js_1.WsDBTypes[this.databaseType]);
        const sendData = {
            op: enums_js_1.TransmitterOp.SET,
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
                if (parsedData.op === enums_js_1.ReceiverOp.ACK_SET) {
                    resolve({
                        o: performance.now() - start,
                        ...parsedData,
                    });
                }
                else if (parsedData.op === enums_js_1.ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    async _get(table, key, id) {
        const start = performance.now();
        const sendData = {
            op: enums_js_1.TransmitterOp.GET,
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
                if (parsedData.op === enums_js_1.ReceiverOp.ACK_GET) {
                    resolve({ o: performance.now() - start, ...parsedData });
                }
                else if (parsedData.op === enums_js_1.ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    async _delete(table, key, primary) {
        const start = performance.now();
        const sendData = {
            op: enums_js_1.TransmitterOp.DELETE,
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
                if (parsedData.op === enums_js_1.ReceiverOp.ACK_DELETE) {
                    resolve({
                        o: performance.now() - start,
                        ...parsedData,
                    });
                }
                else if (parsedData.op === enums_js_1.ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    async _all(table, { filter, limit, column, sortOrder, } = {}) {
        const start = performance.now();
        const sendData = {
            op: enums_js_1.TransmitterOp.ALL,
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
                if (parsedData.op === enums_js_1.ReceiverOp.ACK_ALL) {
                    resolve({
                        o: performance.now() - start,
                        ...parsedData,
                    });
                }
                else if (parsedData.op === enums_js_1.ReceiverOp.ERROR) {
                    reject(parsedData);
                }
            });
        });
    }
    async _clear(table, column) {
        const start = performance.now();
        const sendData = {
            op: enums_js_1.TransmitterOp.CLEAR,
            d: {
                table,
                column,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === enums_js_1.ReceiverOp.ACK_CLEAR) {
                    resolve({
                        o: performance.now() - start,
                        ...parsedData,
                    });
                }
                else if (parsedData.op === enums_js_1.ReceiverOp.ERROR) {
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
exports.Transmitter = Transmitter;
//# sourceMappingURL=database.js.map