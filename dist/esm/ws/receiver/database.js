import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import { ReceiverOp, TransmitterFlags, TransmitterOp, WsEventsList as ReceiverEvents, } from "../../typings/enums.js";
export class Receiver extends TypedEmitter {
    connection;
    options;
    clients = new Map();
    _ping = -1;
    lastPingTimestamp = -1;
    _currentSequence = 0;
    db;
    databaseType;
    constructor(options) {
        super();
        this.connection = new ws.Server(options.wsOptions);
        this.options = options;
        this.databaseType = options.databaseType;
        if (this.databaseType === "KeyValue") {
            this.db = new KeyValue(options.dbOptions);
        }
        else {
            this.db = new WideColumn(options.dbOptions);
        }
        this.db.connect();
    }
    connect() {
        this.connection.on("connection", (socket, request) => {
            if (this.options.whitelistedIps !== "*" &&
                this.options.whitelistedIps.indexOf(request.socket.remoteAddress || "") === -1) {
                socket.close(3000, "Ip Not Whitelisted");
                return;
            }
            this.emit(ReceiverEvents.CONNECT);
            socket.on("open", () => {
            });
            this.clients.set(request.socket.remoteAddress || socket.url, {});
            socket.on("message", async (data) => {
                const parsedData = JSON.parse(data);
                this.emit(ReceiverEvents.MESSAGE, parsedData);
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
                    this.load(request.socket.remoteAddress || socket.url, parsedData.data);
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_TABLES,
                        sequence: this._currentSequence,
                        timestamp: Date.now(),
                        databaseType: this.databaseType,
                        data: "Tables Opened",
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.SET) {
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
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
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === TransmitterFlags.WRITE_ONLY) {
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
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
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
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
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
    load(socket, { tables, flags, }) {
        this.clients.set(socket, {
            tables,
            flags,
        });
    }
}
//# sourceMappingURL=database.js.map