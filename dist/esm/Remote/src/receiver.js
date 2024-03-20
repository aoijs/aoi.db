import EventEmitter from "node:events";
import { createServer, isIPv4, isIPv6 } from "node:net";
import { DatabaseEvents, DatabaseMethod, KeyValue, decrypt, encrypt, parseTransmitterQuery, } from "../../index.js";
import { ReceiverOpCodes, TransmitterOpCodes } from "../typings/enum.js";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { inspect } from "node:util";
export default class Receiver extends EventEmitter {
    server;
    options;
    allowList = new Set();
    connections = new Map();
    constructor(options) {
        super();
        this.options = options;
        this.server = createServer();
        this.server.listen(options.port, options.host, options.backlog, () => {
            this.emit(DatabaseEvents.Connect);
        });
    }
    allowAddress(address) {
        if (address === "*")
            this.allowList.add("*");
        else if (isIPv4(address)) {
            //convert it to ipv6
            const ipv6 = "::ffff:" + address;
            this.allowList.add(ipv6);
        }
        else if (isIPv6(address)) {
            this.allowList.add(address);
        }
        else {
            throw new Error("Invalid IP Address Provided");
        }
    }
    isAllowed(address) {
        let ipv6 = isIPv6(address) ? address : "::ffff:" + address;
        return this.allowList.has("*") || this.allowList.has(ipv6);
    }
    async #createOwner(options, username, password) {
        const text = `@name=${username}@pass=${password}`;
        const hash = encrypt(text, options.encryptionConfig.securityKey);
        await writeFile(`${options.dataConfig?.path}/owner.hash`, `${hash.iv}:${hash.data}`, { encoding: "utf-8" });
    }
    #bindEvents() {
        this.server.on("connection", (socket) => {
            this.emit(DatabaseEvents.Debug, "[Receiver]: New Connection with ip: " + socket.remoteAddress);
            socket.on("data", async (buffer) => {
                const data = this.transmitterDataFormat(buffer);
                this.emit(DatabaseEvents.Debug, `[Receiver]: Received Data: ${inspect(data)}`);
                let isAnaylze = false;
                switch (data.op) {
                    case TransmitterOpCodes.Connect:
                        {
                            if (!this.isAllowed(socket.remoteAddress)) {
                                const res = this.sendDataFormat({
                                    op: ReceiverOpCodes.ConnectionDenied,
                                    method: data.m,
                                    seq: data.s,
                                    data: "IP Address Not Allowed",
                                    cost: 0,
                                    hash: data.h,
                                });
                                socket.end(res);
                                return;
                            }
                            const username = data.d.u;
                            const password = data.d.p;
                            const db = data.d.db.t;
                            if (db === "KeyValue") {
                                const options = data.d.db
                                    .o;
                                const mainFolder = Buffer.from(username).toString("base64url");
                                const defaultFolder = options.dataConfig?.path ?? "database";
                                options.dataConfig = {
                                    path: `./${mainFolder}_${defaultFolder}`,
                                    tables: options.dataConfig?.tables || ['main'],
                                    referencePath: `./reference`,
                                };
                                options.fileConfig = {
                                    extension: options.fileConfig?.extension || ".sql",
                                    maxSize: options.fileConfig?.maxSize ||
                                        20 * 1024 * 1024,
                                    transactionLogPath: `./transactions`,
                                };
                                const keyvalue = new KeyValue(options);
                                if (existsSync(options.dataConfig.path)) {
                                    const ownerHsh = await readFile(`${options.dataConfig.path}/owner.hash`, { encoding: "utf-8" });
                                    const [iv, ecrypted] = ownerHsh.split(":");
                                    const hash = { iv, data: ecrypted };
                                    const decrypted = decrypt(hash, options.encryptionConfig.securityKey);
                                    const splits = decrypted.split("@").slice(1);
                                    const [name, pass] = splits.map((x) => {
                                        const [_, prop] = x.split("=");
                                        return prop;
                                    });
                                    if (name !== username ||
                                        pass !== password) {
                                        const res = this.sendDataFormat({
                                            op: ReceiverOpCodes.ConnectionDenied,
                                            method: data.m,
                                            seq: data.s,
                                            data: "Invalid Username or Password",
                                            cost: 0,
                                            hash: data.h,
                                        });
                                        socket.end(res);
                                        return;
                                    }
                                }
                                await keyvalue.connect();
                                if (!existsSync(options.dataConfig.path + "/owner.hash")) {
                                    await this.#createOwner(options, username, password);
                                }
                                this.connections.set(socket.remoteAddress, keyvalue);
                                const res = this.sendDataFormat({
                                    op: ReceiverOpCodes.AckConnect,
                                    method: data.m,
                                    seq: data.s + 1,
                                    data: "Connected",
                                    cost: 0,
                                    hash: data.h,
                                });
                                socket.write(res);
                            }
                        }
                        break;
                    case TransmitterOpCodes.Ping:
                        {
                            const res = this.sendDataFormat({
                                op: ReceiverOpCodes.Pong,
                                method: data.m,
                                seq: data.s,
                                data: "Pong",
                                cost: 0,
                                hash: data.h,
                            });
                            socket.write(res);
                        }
                        break;
                    case TransmitterOpCodes.Analyze:
                        isAnaylze = true;
                    /* FALLTHROUGH */
                    case TransmitterOpCodes.Operation:
                        {
                            const db = this.connections.get(socket.remoteAddress);
                            if (!db) {
                                const res = this.sendDataFormat({
                                    op: ReceiverOpCodes.ConnectionDenied,
                                    method: data.m,
                                    seq: data.s,
                                    data: "Not Connected",
                                    cost: 0,
                                    hash: data.h,
                                });
                                socket.end(res);
                                return;
                            }
                            const method = data.m;
                            let seq = data.s;
                            switch (method) {
                                case DatabaseMethod.Set:
                                    {
                                        seq++;
                                        const table = data.d.table;
                                        const key = data.d.key;
                                        const value = data.d.value;
                                        const startTime = performance.now();
                                        const d = await db.set(table, key, value);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case DatabaseMethod.Get:
                                    {
                                        const table = data.d.table;
                                        const key = data.d.key;
                                        const startTime = performance.now();
                                        const d = await db.get(table, key);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case DatabaseMethod.Delete:
                                    {
                                        const table = data.d.table;
                                        const key = data.d.key;
                                        const startTime = performance.now();
                                        const d = await db.delete(table, key);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d?.value ?? null,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case DatabaseMethod.Has:
                                    {
                                        const table = data.d.table;
                                        const key = data.d.key;
                                        const startTime = performance.now();
                                        const d = await db.has(table, key);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d ?? false,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case DatabaseMethod.Clear:
                                    {
                                        const table = data.d.table;
                                        const startTime = performance.now();
                                        const d = await db.clear(table);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case DatabaseMethod.All:
                                    {
                                        const table = data.d.table;
                                        const query = parseTransmitterQuery(data.d.query);
                                        const startTime = performance.now();
                                        const d = await db.all(table, query);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case DatabaseMethod.FindOne:
                                    {
                                        const table = data.d.table;
                                        const query = parseTransmitterQuery(data.d.query);
                                        const startTime = performance.now();
                                        const d = await db.findOne(table, query);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case DatabaseMethod.FindMany:
                                    {
                                        const table = data.d.table;
                                        const query = parseTransmitterQuery(data.d.query);
                                        const startTime = performance.now();
                                        const d = await db.findMany(table, query);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case DatabaseMethod.DeleteMany:
                                    {
                                        seq++;
                                        const table = data.d.table;
                                        const query = parseTransmitterQuery(data.d.query);
                                        const startTime = performance.now();
                                        const d = await db.deleteMany(table, query);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? ReceiverOpCodes.AckAnalyze
                                                : ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                            }
                        }
                        break;
                }
            });
        });
    }
    sendDataFormat({ op, method, seq, data, cost, hash, }) {
        const res = {
            op: op,
            m: method,
            t: Date.now(),
            s: seq,
            d: data,
            c: cost,
            h: hash,
        };
        return Buffer.from(JSON.stringify(res));
    }
    transmitterDataFormat(buffer) {
        return JSON.parse(buffer.toString());
    }
    connect() {
        return this.#bindEvents();
    }
}
//# sourceMappingURL=receiver.js.map