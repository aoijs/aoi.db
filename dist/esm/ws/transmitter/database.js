import ws from "ws";
import { WideColumnMemMap } from "../../column/cacher.js";
import { WideColumnData } from "../../column/data.js";
import { Cacher } from "../../keyvalue/cacher.js";
import { Data } from "../../keyvalue/data.js";
import { ReceiverOp, TransmitterOp } from "../../typings/enums.js";
export class Transmitter {
    connection;
    cache;
    options;
    _ping = -1;
    lastPingTimestamp = -1;
    sequence = 0;
    databaseType;
    constructor(options) {
        this.connection = new ws(options.path, options.wsOptions);
        this.options = options;
    }
    connect() {
        this.connection.on("open", () => {
            this.connection.send(JSON.stringify({
                op: TransmitterOp.REQUEST,
            }));
        });
        this.connection.on("message", (data) => {
            const parsedData = JSON.parse(data);
            if (parsedData.op === ReceiverOp.ACK_CONNECTION) {
                this.databaseType = parsedData.databaseType;
                const sendData = {
                    op: TransmitterOp.BULK_TABLE_OPEN,
                    data: {
                        tables: this.options.tables,
                        flags: this.options.flags,
                    },
                };
                this.connection.send(JSON.stringify(sendData));
            }
            else if (parsedData.op === ReceiverOp.ACK_TABLES) {
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
                if (this.options.type === "KeyValue") {
                    const cache = new Cacher(this.options.cacheOption ?? { limit: 10000 });
                    this.cache = cache;
                    parsedData.data.forEach((x) => {
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
                    parsedData.data.forEach((x) => {
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
    }
    set(table, key, data) {
        const sendData = {
            op: TransmitterOp.SET,
            data: {
                table,
                key,
                data,
            },
        };
        this.connection.send(JSON.stringify(sendData));
    }
    async get(table, key, id) {
        const sendData = {
            op: TransmitterOp.GET,
            data: {
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
                    resolve(parsedData.data);
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData.error);
                }
            });
        });
    }
    delete(table, key, primary) {
        const sendData = {
            op: TransmitterOp.DELETE,
            data: {
                table,
                key,
                primary,
            },
        };
        this.connection.send(JSON.stringify(sendData));
    }
    async all(table, { filter, limit, column, } = {}) {
        const sendData = {
            op: TransmitterOp.ALL,
            data: {
                table,
                filter,
                limit,
                column,
            },
        };
        this.connection.send(JSON.stringify(sendData));
        return new Promise((resolve, reject) => {
            this.connection.once("message", (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === ReceiverOp.ACK_ALL) {
                    resolve(parsedData.data);
                }
                else if (parsedData.op === ReceiverOp.ERROR) {
                    reject(parsedData.error);
                }
            });
        });
    }
    get ping() {
        return this._ping;
    }
}
//# sourceMappingURL=database.js.map