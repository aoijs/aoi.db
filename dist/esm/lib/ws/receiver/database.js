import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, } from "fs";
import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import { ReceiverOp, TransmitterFlags, TransmitterOp, WsDBTypes, WsEventsList as ReceiverEvents, } from "../../typings/enums.js";
import { decrypt, encrypt, JSONParser, } from "../../utils/functions.js";
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
            path: this.options.logPath ?? "./logs/",
            key: this.options.logEncrypt,
        };
    }
    connect() {
        if (!existsSync(this.logData.path)) {
            mkdirSync(this.logData.path, { recursive: true });
            const iv = randomBytes(16).toString("hex");
            writeFileSync(this.logData.path + "1_1000.log", iv);
            this.logData.logs["1_1000.log"] = iv;
            this.logData.currentLogFile = this.logData.path + "1_1000.log";
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
                    const path = `name:${parsedData.d.name}@pass:${parsedData.d.pass}@path:${parsedData.d.options.path ?? "./database/"}@type:${parsedData.d.dbType}`;
                    const hash = encrypt(path, this.logData.key);
                    if (parsedData.d.dbType === WsDBTypes.KeyValue) {
                        const keys = [...this.clients.keys()].map((x) => {
                            const [iv, data] = x.split(":");
                            return { parsed: decrypt({ iv, data }, this.logData.key), raw: x };
                        });
                        const key = keys.find((x) => x.parsed === path);
                        if (!key) {
                            if (existsSync(parsedData.d.options.path)) {
                                const readData = JSONParser(readFileSync(parsedData.d.options.path + "owner.hsh").toString());
                                const decrypted = decrypt(readData, this.logData.key);
                                if (decrypted !== path) {
                                    const [_name, _pass, _path, _type] = decrypted.split("@");
                                    if (`name:${parsedData.d.name}` === _name &&
                                        `pass:${parsedData.d.pass}` !== _pass &&
                                        `path:${parsedData.d.options.path}` === _path &&
                                        `type:${parsedData.d.dbType}` === _type) {
                                        socket.close(3000, "Wrong Password");
                                        return;
                                    }
                                    else if (`name:${parsedData.d.name}` === _name &&
                                        `pass:${parsedData.d.pass}` === _pass &&
                                        `path:${parsedData.d.options.path}` === _path &&
                                        `type:${parsedData.d.dbType}` !== _type) {
                                        socket.close(3000, "Wrong Type");
                                        return;
                                    }
                                    else if (`name:${parsedData.d.name}` === _name &&
                                        `pass:${parsedData.d.pass}` === _pass &&
                                        `path:${parsedData.d.options.path}` !== _path) {
                                        parsedData.d.options.path =
                                            parsedData.d.options.path + "_1";
                                    }
                                }
                            }
                            data = {
                                databaseType: WsDBTypes.KeyValue,
                                db: new KeyValue(parsedData.d.options),
                            };
                            data.db.connect();
                            if (!existsSync(parsedData.d.options.path + "/owner.hsh")) {
                                writeFileSync(data.db.options.path + "/owner.hsh", JSON.stringify(hash));
                            }
                            // @ts-ignore
                            socket.sessionId = `${hash.iv}:${hash.data}`;
                            this.clients.set(`${hash.iv}:${hash.data}`, data);
                        }
                        else {
                            data = this.clients.get(key.raw);
                        }
                    }
                    else {
                        data = {
                            databaseType: WsDBTypes.WideColumn,
                            db: new WideColumn(parsedData.d.options),
                        };
                        this.clients.set(`${hash.iv}:${hash.data}`, data);
                    }
                    this._currentSequence += 1;
                    const sendData = {
                        op: ReceiverOp.ACK_CONNECTION,
                        db: data.databaseType,
                        d: null,
                        t: Date.now(),
                        s: this._currentSequence,
                        sk: `${hash.iv}:${hash.data}`,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.PING) {
                    const sk = (this.clients.get(socket.sessionId));
                    this.lastPingTimestamp = Date.now();
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
                    this.load(socket.sessionId, parsedData.d);
                    const sk = this.clients.get(socket.sessionId);
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
                    const sk = this.clients.get(socket.sessionId);
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
                    const start = performance.now();
                    await sk.db.set(parsedData.d.table, parsedData.d.key, parsedData.d.data);
                    const end = performance.now() - start;
                    const sendData = {
                        op: ReceiverOp.ACK_SET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                        a: end,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.GET) {
                    this._currentSequence += 1;
                    const sk = this.clients.get(socket.sessionId);
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
                    let searchTime;
                    if (sk.databaseType === WsDBTypes.KeyValue) {
                        const db = sk.db;
                        const start = performance.now();
                        get = await db.get(parsedData.d.table, parsedData.d.key);
                        searchTime = performance.now() - start;
                    }
                    else {
                        const db = sk.db;
                        const start = performance.now();
                        get = await db.get(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                        searchTime = performance.now() - start;
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_GET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: get,
                        a: searchTime,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.DELETE) {
                    const sk = this.clients.get(socket.sessionId);
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
                    let searchTime;
                    if (sk.databaseType === WsDBTypes.KeyValue) {
                        const start = performance.now();
                        await sk.db.delete(parsedData.d.table, parsedData.d.key);
                        searchTime = performance.now() - start;
                    }
                    else if (sk.databaseType === WsDBTypes.WideColumn) {
                        const start = performance.now();
                        await sk.db.delete(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                        searchTime = performance.now() - start;
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_DELETE,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                        a: searchTime,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.ALL) {
                    const sk = this.clients.get(socket.sessionId);
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
                    let searchTime;
                    if (sk?.databaseType === WsDBTypes.KeyValue) {
                        const start = performance.now();
                        all = await sk.db.all(parsedData.d.table, parsedData.d.filter, parsedData.d.limit, parsedData.d.sortOrder);
                        searchTime = performance.now() - start;
                    }
                    else if (sk?.databaseType === WsDBTypes.WideColumn) {
                        const start = performance.now();
                        all = await (parsedData.d.column
                            ? sk.db.all(parsedData.d.table, parsedData.d.column, parsedData.d.filter, parsedData.d.limit)
                            : sk.db.allData(parsedData.d.table));
                        searchTime = performance.now() - start;
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_ALL,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk?.databaseType,
                        d: all,
                        a: searchTime,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.CLEAR) {
                    const sk = this.clients.get(socket.sessionId);
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
                    let searchTime;
                    if (sk?.databaseType === WsDBTypes.KeyValue) {
                        const start = performance.now();
                        sk.db.clear(parsedData.d.table);
                        searchTime = performance.now() - start;
                    }
                    else if (sk.databaseType === WsDBTypes.WideColumn) {
                        const start = performance.now();
                        if (!parsedData.d.column) {
                            sk.db.clearTable(parsedData.d.table);
                        }
                        else {
                            sk.db.clearColumn(parsedData.d.table, parsedData.d.column);
                        }
                        searchTime = performance.now() - start;
                    }
                    const sendData = {
                        op: ReceiverOp.ACK_CLEAR,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk?.databaseType,
                        d: null,
                        a: searchTime,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === TransmitterOp.LOGS) {
                }
            });
            socket.on("close", () => {
                this.clients.delete(socket.sessionId);
            });
        });
        this.connection.on("close", () => {
            clearInterval(this.#interval);
        });
    }
    load(socket, { tables, flags, }) {
        //@ts-ignore
        this.clients.set(socket, {
            // @ts-ignore
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