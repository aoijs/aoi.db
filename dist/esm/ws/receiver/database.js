import { existsSync, writeFileSync } from "fs";
import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import { ReceiverOp, TransmitterFlags, TransmitterOp, } from "../../typings/enums.js";
export class Receiver {
    connection;
    options;
    _ping = -1;
    flags;
    lastPingTimestamp = -1;
    _currentSequence = 0;
    db;
    databaseType;
    constructor(options) {
        this.connection = new ws.Server(options.wsOptions);
        this.options = options;
        this.databaseType = options.databaseType;
        if (this.databaseType === "KeyValue") {
            this.db = new KeyValue(options.dbOptions);
        }
        else {
            this.db = new WideColumn(options.dbOptions);
        }
        if (!existsSync(`${this.options.dbOptions.path}/sequences.log`)) {
            writeFileSync(`${this.options.dbOptions.path}/sequences.log`, JSON.stringify({}));
        }
    }
    connect() {
        this.connection.on("connection", (socket, request) => {
            if (this.options.whitelistedIps !== "*" &&
                this.options.whitelistedIps.indexOf(request.socket.remoteAddress || "") === -1) {
                socket.close(3000, "Ip Not Whitelisted");
                return;
            }
            socket.on("message", async (data) => {
                const parsedData = JSON.parse(data);
                if (parsedData.op === TransmitterOp.REQUEST) {
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_CONNECTION,
                        databaseType: this.databaseType,
                        data: "Request Accepted",
                        timestamp: Date.now(),
                        sequence: this._currentSequence,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.PING) {
                    this.lastPingTimestamp = Date.now();
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_PING,
                        sequence: this._currentSequence,
                        timestamp: Date.now(),
                        databaseType: this.databaseType,
                        data: "Ping Acknowledged",
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.BULK_TABLE_OPEN) {
                    this.load(parsedData.data);
                }
                else if (parsedData.op === TransmitterOp.SET) {
                    if (this.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            sequence: this._currentSequence,
                            timestamp: Date.now(),
                            databaseType: this.databaseType,
                            data: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    await this.db.set(parsedData.data.table, parsedData.data.key, parsedData.data.data);
                    const sendData = {
                        op: ReceiverOp.ACK_SET,
                        sequence: this._currentSequence,
                        timestamp: Date.now(),
                        databaseType: this.databaseType,
                        data: "Set Acknowledged",
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.GET) {
                    this._currentSequence += 1;
                    if (this.flags === TransmitterFlags.WRITE_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            sequence: this._currentSequence,
                            timestamp: Date.now(),
                            databaseType: this.databaseType,
                            data: "Database is write only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    let get;
                    if (this.databaseType === "KeyValue") {
                        const db = this.db;
                        get = await db.get(parsedData.data.table, parsedData.data.key);
                    }
                    else {
                        const db = this.db;
                        get = await db.get(parsedData.data.table, parsedData.data.key, parsedData.data.primary);
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_GET,
                        sequence: this._currentSequence,
                        timestamp: Date.now(),
                        databaseType: this.databaseType,
                        data: get,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.DELETE) {
                    if (this.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            sequence: this._currentSequence,
                            timestamp: Date.now(),
                            databaseType: this.databaseType,
                            data: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    if (this.databaseType === "KeyValue") {
                        await this.db.delete(parsedData.data.table, parsedData.data.key);
                    }
                    else if (this.databaseType === "WideColumn") {
                        await this.db.delete(parsedData.data.table, parsedData.data.key, parsedData.data.primary);
                    }
                }
                else if (parsedData.op === TransmitterOp.ALL) {
                    if (this.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            sequence: this._currentSequence,
                            timestamp: Date.now(),
                            databaseType: this.databaseType,
                            data: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    let all;
                    if (this.databaseType === "KeyValue") {
                        all = await this.db.all(parsedData.data.table);
                    }
                    else if (this.databaseType === "WideColumn") {
                        all = await (parsedData.data.column
                            ? this.db.all(parsedData.data.table, parsedData.data.column, parsedData.data.filter, parsedData.data.limit)
                            : this.db.allData(parsedData.data.table));
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_ALL,
                        sequence: this._currentSequence,
                        timestamp: Date.now(),
                        databaseType: this.databaseType,
                        data: all,
                    };
                    socket.send(JSON.stringify(sendData));
                }
            });
        });
    }
    load({ tables, flags, }) {
        this.db.options.tables = tables;
        this.flags = flags;
        this.db.connect();
    }
}
//# sourceMappingURL=database.js.map