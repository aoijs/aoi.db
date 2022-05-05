import { randomBytes } from "crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import { ReceiverOp, TransmitterFlags, TransmitterOp, WsDBTypes, WsEventsList as ReceiverEvents, } from "../../typings/enums.js";
import { encrypt } from "../../utils/functions.js";
function heartbeat(socket) {
    //@ts-ignore
    socket.isAlive = true;
}
export class Receiver extends TypedEmitter {
    logData;
    connection;
    options;
    clients = new Map();
    _ping = -1;
    lastPingTimestamp = -1;
    _currentSequence = 0;
    #interval;
    constructor(options) {
        super();
        this.connection = new ws.Server(options.wsOptions);
        this.options = options;
        this.logData = {
            currentLogFile: "",
            logs: {},
            path: this.options.logPath ?? "./logs",
            key: this.options.logEncrypt,
        };
    }
    connect() {
        if (!existsSync(this.options.logPath ?? "./logs/")) {
            const iv = randomBytes(16).toString("hex");
            writeFileSync(this.options.logPath ?? "./logs/1_1000.log", iv);
            this.logData.logs["1_1000.log"] = iv;
            this.logData.currentLogFile = "./logs/1_1000.log";
        }
        else {
            const files = readdirSync(this.logData.path).sort((a, b) => Number(a.split("_")[0]) - Number(b.split("_")[0]));
            this.logData.currentLogFile = files.pop() ?? "";
            files.forEach((x) => {
                const iv = readFileSync(`${this.logData.path}/${x}`)
                    .toString()
                    .split("\n")[0];
                this.logData.logs[x] = iv;
            });
        }
        this.#clearDeadClients();
        this.connection.on("connection", (socket, request) => {
            //@ts-ignore
            socket.isAlive = true;
            socket.on("pong", () => heartbeat(socket));
            if (this.options.whitelistedIps !== "*" &&
                this.options.whitelistedIps.indexOf(request.socket.remoteAddress || "") === -1) {
                socket.close(3000, "Ip Not Whitelisted");
                return;
            }
            this.emit(ReceiverEvents.CONNECT);
            socket.on("open", () => { });
            socket.on("message", async (data) => {
                const parsedData = JSON.parse(data);
                this.emit(ReceiverEvents.MESSAGE, parsedData);
                if (parsedData.op === TransmitterOp.REQUEST) {
                    let data;
                    if (parsedData.d.dbType === WsDBTypes.KeyValue) {
                        const hash = encrypt(`name:${parsedData.d.name}@pass:${parsedData.d.pass}@path:${parsedData.d.options.path ?? "./database/"}@type:${parsedData.d.dbType}`, this.logData.key);
                        (parsedData.d.options).path = `${hash.data}_${hash.iv}`;
                        data = {
                            databaseType: WsDBTypes.KeyValue,
                            db: new KeyValue(parsedData.d.options),
                        };
                        this.clients.set(request.socket.remoteAddress, data);
                    }
                    else {
                        data = {
                            databaseType: WsDBTypes.WideColumn,
                            db: new WideColumn(parsedData.d.options),
                        };
                        this.clients.set(request.socket.remoteAddress, data);
                    }
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_CONNECTION,
                        db: data.databaseType,
                        d: null,
                        t: Date.now(),
                        s: this._currentSequence,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.PING) {
                    const sk = (this.clients.get(request.socket.remoteAddress));
                    this.lastPingTimestamp = Date.now();
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_PING,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.BULK_TABLE_OPEN) {
                    this.load(request.socket.remoteAddress || socket.url, parsedData.d);
                    const sk = (this.clients.get(request.socket.remoteAddress));
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_TABLES,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.SET) {
                    const sk = (this.clients.get(request.socket.remoteAddress || socket.url));
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    await sk.db.set(parsedData.d.table, parsedData.d.key, parsedData.d.data);
                    const sendData = {
                        op: ReceiverOp.ACK_SET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.GET) {
                    this._currentSequence += 1;
                    const sk = (this.clients.get(request.socket.remoteAddress));
                    if (sk?.flags === TransmitterFlags.WRITE_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is write only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    let get;
                    if (sk.databaseType === WsDBTypes.KeyValue) {
                        const db = sk.db;
                        get = await db.get(parsedData.d.table, parsedData.d.key);
                    }
                    else {
                        const db = sk.db;
                        get = await db.get(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_GET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: get,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.DELETE) {
                    const sk = (this.clients.get(request.socket.remoteAddress || socket.url));
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    if (sk.databaseType === WsDBTypes.KeyValue) {
                        await sk.db.delete(parsedData.d.table, parsedData.d.key);
                    }
                    else if (sk.databaseType === WsDBTypes.WideColumn) {
                        await sk.db.delete(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_DELETE,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.ALL) {
                    const sk = (this.clients.get(request.socket.remoteAddress || socket.url));
                    if (sk?.flags === TransmitterFlags.WRITE_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is write only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    let all;
                    if (sk?.databaseType === WsDBTypes.KeyValue) {
                        all = await sk.db.all(parsedData.d.table, parsedData.d.filter, parsedData.d.limit, parsedData.d.sortOrder);
                    }
                    else if (sk?.databaseType === WsDBTypes.WideColumn) {
                        all = await (parsedData.d.column
                            ? sk.db.all(parsedData.d.table, parsedData.d.column, parsedData.d.filter, parsedData.d.limit)
                            : sk.db.allData(parsedData.d.table));
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_ALL,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk?.databaseType,
                        d: all,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.CLEAR) {
                    const sk = (this.clients.get(request.socket.remoteAddress || socket.url));
                    if (sk?.flags === TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    if (sk?.databaseType === WsDBTypes.KeyValue) {
                        sk.db.clear(parsedData.d.table);
                    }
                    else if (sk.databaseType === WsDBTypes.WideColumn) {
                        if (!parsedData.d.column) {
                            sk.db.clearTable(parsedData.d.table);
                        }
                        else {
                            sk.db.clearColumn(parsedData.d.table, parsedData.d.column);
                        }
                    }
                }
                else if (parsedData.op === TransmitterOp.LOGS) {
                }
            });
            socket.on("close", () => {
                this.clients.delete(request.socket.remoteAddress);
            });
        });
        this.connection.on("close", () => {
            clearInterval(this.#interval);
        });
    }
    load(socket, { tables, flags, }) {
        this.clients.set(socket, {
            ...this.clients.get(socket),
            tables,
            flags,
        });
    }
    logSequence(socket, sequence, data) {
        const key = this.options.logEncrypt;
        if (!key)
            throw new Error("Log Encryption key not set");
    }
    #clearDeadClients() {
        this.#interval = setInterval(() => {
            this.connection.clients.forEach((ws) => {
                // @ts-ignore
                if (ws.isAlive === false) {
                    return ws.terminate();
                }
                // @ts-ignore
                ws.isAlive = false;
                ws.ping();
            });
        }, 41250);
    }
}
//# sourceMappingURL=database.js.map