import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import { ReceiverOp, TransmitterFlags, TransmitterOp, WsDBTypes, WsEventsList as ReceiverEvents, } from "../../typings/enums.js";
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
            socket.on("open", () => { });
            this.clients.set(request.socket.remoteAddress || socket.url, {});
            socket.on("message", async (data) => {
                const parsedData = JSON.parse(data);
                this.emit(ReceiverEvents.MESSAGE, parsedData);
                if (parsedData.op === TransmitterOp.REQUEST) {
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_CONNECTION,
                        db: WsDBTypes[this.databaseType],
                        d: "Request Accepted",
                        t: Date.now(),
                        s: this._currentSequence,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.PING) {
                    this.lastPingTimestamp = Date.now();
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_PING,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: WsDBTypes[this.databaseType],
                        d: "Ping Acknowledged",
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.BULK_TABLE_OPEN) {
                    this.load(request.socket.remoteAddress || socket.url, parsedData.d);
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_TABLES,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: WsDBTypes[this.databaseType],
                        d: "Tables Opened",
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.SET) {
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: WsDBTypes[this.databaseType],
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    await this.db.set(parsedData.d.table, parsedData.d.key, parsedData.d.data);
                    const sendData = {
                        op: ReceiverOp.ACK_SET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: WsDBTypes[this.databaseType],
                        d: "Set Acknowledged",
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.GET) {
                    this._currentSequence += 1;
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === TransmitterFlags.WRITE_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: WsDBTypes[this.databaseType],
                            d: "Database is write only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    let get;
                    if (this.databaseType === "KeyValue") {
                        const db = this.db;
                        get = await db.get(parsedData.d.table, parsedData.d.key);
                    }
                    else {
                        const db = this.db;
                        get = await db.get(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_GET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: WsDBTypes[this.databaseType],
                        d: get,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.DELETE) {
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: WsDBTypes[this.databaseType],
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    if (this.databaseType === "KeyValue") {
                        await this.db.delete(parsedData.d.table, parsedData.d.key);
                    }
                    else if (this.databaseType === "WideColumn") {
                        await this.db.delete(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                    }
                }
                else if (parsedData.op === TransmitterOp.ALL) {
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: WsDBTypes[this.databaseType],
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    let all;
                    if (this.databaseType === "KeyValue") {
                        all = await this.db.all(parsedData.d.table, parsedData.d.filter, parsedData.d.limit, parsedData.d.sortOrder);
                    }
                    else if (this.databaseType === "WideColumn") {
                        all = await (parsedData.d.column
                            ? this.db.all(parsedData.d.table, parsedData.d.column, parsedData.d.filter, parsedData.d.limit)
                            : this.db.allData(parsedData.d.table));
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_ALL,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: WsDBTypes[this.databaseType],
                        d: all,
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