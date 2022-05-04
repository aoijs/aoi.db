import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumnMemMap } from "../../column/cacher.js";
import { WideColumnData } from "../../column/data.js";
import { Cacher } from "../../keyvalue/cacher.js";
import { Data } from "../../keyvalue/data.js";
import { ReceiverOp, WsEventsList as TransmitterEvents, TransmitterOp, TransmitterDBTypes, } from "../../typings/enums.js";
export class Transmitter extends TypedEmitter {
    connection;
    cache;
    options;
    _ping = -1;
    lastPingTimestamp = -1;
    sequence = 0;
    databaseType;
    constructor(options) {
        super();
        this.connection = new ws(options.path, options.wsOptions);
        this.options = options;
    }
    connect() {
        this.connection.on("open", () => {
            this.emit(TransmitterEvents.OPEN);
            this.connection.send(JSON.stringify({
                op: TransmitterOp.REQUEST,
            }));
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
            this.emit(TransmitterEvents.CLOSE, code, reason);
        });
        this.connection.on("error", (err) => {
            this.emit(TransmitterEvents.ERROR, err);
        });
    }
    async set(table, key, data) {
        const sendData = {
            op: TransmitterOp.SET,
            d: {
                table,
                key,
                data,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === ReceiverOp.ACK_SET) {
                    resolve(parsedData.d);
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData.d);
                }
            });
        });
    }
    async get(table, key, id) {
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
                    resolve(parsedData.d);
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData.d);
                }
            });
        });
    }
    async delete(table, key, primary) {
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
                    resolve(parsedData.d);
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData.d);
                }
            });
        });
    }
    async all(table, { filter, limit, column, sortOrder, } = {}) {
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
                    resolve(parsedData.d);
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData.d);
                }
            });
        });
    }
    async clear(table) {
        const sendData = {
            op: TransmitterOp.CLEAR,
            d: {
                table,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === ReceiverOp.ACK_CLEAR) {
                    resolve(parsedData.d);
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData.d);
                }
            });
        });
    }
    get ping() {
        return this._ping;
    }
}
//# sourceMappingURL=database.js.map