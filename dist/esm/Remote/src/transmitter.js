import EventEmitter from "events";
import { createConnection } from "net";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import { KeyValueData } from "../../index.js";
import { randomBytes } from "crypto";
import { ReceiverOpCodes, TransmitterOpCodes } from "../typings/enum.js";
import { inspect } from "util";
export default class Transmitter extends EventEmitter {
    client;
    options;
    data = {
        seq: 0,
        lastPingTimestamp: -1,
        ping: -1,
    };
    pingInterval = null;
    readyAt = -1;
    session;
    #maxRetries = 10;
    #retries = 0;
    #waitTime = 1000;
    #chunk = "";
    constructor(options) {
        super();
        this.client = createConnection(options, () => {
            const reqData = this.sendDataFormat(TransmitterOpCodes.Connect, DatabaseMethod.NOOP, Date.now(), this.data.seq, {
                u: options.username,
                p: options.password,
            });
            this.data.lastPingTimestamp = Date.now();
            this.client.write(reqData);
        });
        this.options = options;
    }
    static createConnection(options) {
        if (!options.path.startsWith("aoidb://"))
            throw new Error("Invalid Protocol Provided for Transmitter. Required: aoidb://");
        const [_, username, password, host, port] = options.path.split(/aoidb:\/\/|:|@/);
        return new Transmitter({
            host,
            port: Number(port),
            username,
            password,
        });
    }
    #createDebug(data) {
        this.emit(DatabaseEvents.Debug, `[Debug: Transmitter -> Sent Data]: ${inspect(data)}`);
    }
    #createData(data) {
        this.emit(DatabaseEvents.Data, `[Debug: Transmitter -> Received Data]: ${inspect(data)}`);
    }
    #processData(dataBuffer) {
        const data = this.receiveDataFormat(dataBuffer);
        this.data.seq = data.s;
        switch (data.op) {
            case ReceiverOpCodes.ConnectionDenied: {
                this.emit(DatabaseEvents.Disconnect, data.d);
                this.data.ping = Date.now() - this.data.lastPingTimestamp;
                return;
            }
            case ReceiverOpCodes.AckConnect:
                {
                    this.session = data.se;
                    this.emit("AckConnect", data.d);
                }
                break;
            case ReceiverOpCodes.Pong:
                {
                    this.data.ping = Date.now() - this.data.lastPingTimestamp;
                }
                break;
        }
        this.#createData(data);
    }
    #bindEvents() {
        this.client.on("data", (buffer) => {
            this.#chunk += buffer.toString(); // Add string on the end of the variable 'chunk'
            let d_index = this.#chunk.indexOf(";"); // Find the delimiter
            // While loop to keep going until no delimiter can be found
            while (d_index > -1) {
                try {
                    const string = this.#chunk.substring(0, d_index); // Create string up until the delimiter
                    const dataBuffer = Buffer.from(string); // Convert string to buffer
                    this.#processData(dataBuffer); // Process the buffer
                    this.#chunk = this.#chunk.substring(d_index + 1); // Cuts off the processed chunk
                    d_index = this.#chunk.indexOf(";"); // Find the new delimiter
                }
                catch (e) {
                    this.#chunk = this.#chunk.substring(d_index + 1); // Cuts off the processed chunk
                    d_index = this.#chunk.indexOf(";"); // Find the new delimiter
                    continue; // Restart the loop
                }
            }
        });
        this.client.on("close", () => {
            this.emit(DatabaseEvents.Disconnect, "Connection Closed");
            this.#reconnect();
        });
        this.client.on("error", (err) => {
            this.emit(DatabaseEvents.Error, err);
            this.#reconnect();
        });
        this.client.on("connect", () => {
            this.emit(DatabaseEvents.Connect, "Connected");
        });
    }
    #reconnect() {
        try {
            clearInterval(this.pingInterval);
            this.client = createConnection(this.options, () => {
                this.#retries = 0;
                const reqData = this.sendDataFormat(TransmitterOpCodes.Connect, DatabaseMethod.NOOP, Date.now(), this.data.seq, {
                    u: this.options.username,
                    p: this.options.password,
                });
                this.data.lastPingTimestamp = Date.now();
                this.client.write(reqData);
            });
            this.connect();
        }
        catch (err) {
            if (this.#retries < this.#maxRetries) {
                this.#retries++;
                setTimeout(() => {
                    this.#reconnect();
                }, this.#waitTime * this.#retries);
            }
            else {
                this.emit(DatabaseEvents.Disconnect, "Max Retries Reached");
            }
        }
    }
    connect() {
        this.#bindEvents();
        this.ping();
        this.pingInterval = setInterval(() => {
            this.ping();
        }, 30000);
        this.readyAt = Date.now();
        this.#retries = 0;
    }
    receiveDataFormat(buffer) {
        const data = JSON.parse(buffer.toString());
        return data;
    }
    sendDataFormat(op, method, timestamp, seq, data) {
        return Buffer.from(JSON.stringify({
            op: op,
            m: method,
            t: timestamp,
            d: data,
            s: seq,
            h: randomBytes(16).toString("hex"),
            se: this.session,
        }) + ";");
    }
    ping() {
        this.data.lastPingTimestamp = Date.now();
        this.client.write(this.sendDataFormat(TransmitterOpCodes.Ping, DatabaseMethod.Ping, this.data.lastPingTimestamp, this.data.seq));
    }
    async #req(op, method, data) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(op, method, Date.now(), this.data.seq, data);
            const _req = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === op, data.m === method && data.h === sendD.h)) {
                    resolve(data);
                }
                this.client.off("data", _req);
            };
            this.client.write(sendData);
            this.#createDebug(data);
            this.client.on("data", _req);
        });
    }
    async get(table, key) {
        const data = (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.Get, {
            table,
            key,
        })).d;
        if (!data)
            return null;
        return new KeyValueData(data);
    }
    async set(table, key, value) {
        return (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.Set, {
            table,
            key,
            value,
        })).d;
    }
    async delete(table, key) {
        return (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.Delete, {
            table,
            key,
        })).d;
    }
    async clear(table) {
        return (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.Clear, {
            table,
        })).d;
    }
    async all(table, query, limit) {
        return (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.All, {
            table,
            query: query?.toString() ?? ((_) => true).toString(),
            limit,
        })).d.map((x) => new KeyValueData(x));
    }
    async has(table, key) {
        return (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.Has, {
            table,
            key,
        })).d;
    }
    async findOne(table, query) {
        const data = (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.FindOne, {
            table,
            query: query.toString(),
        })).d;
        if (!data)
            return null;
        return new KeyValueData(data);
    }
    async findMany(table, query) {
        return (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.FindMany, {
            table,
            query: query.toString(),
        })).d.map((x) => new KeyValueData(x));
    }
    async deleteMany(table, query) {
        return (await this.#req(TransmitterOpCodes.Operation, DatabaseMethod.DeleteMany, {
            table,
            query: query.toString(),
        })).d;
    }
    async analyze(table, data) {
        const sendD = this.sendDataFormat(TransmitterOpCodes.Analyze, DatabaseMethod[data.method], Date.now(), this.data.seq);
        const res = await this.#req(TransmitterOpCodes.Analyze, DatabaseMethod[data.method], {
            table,
            data,
        });
        return this.#formatAnalyzeData(res, JSON.parse(sendD.toString()));
    }
    #formatAnalyzeData(data, sednD) {
        const res = {
            opCode: data.op,
            method: DatabaseMethod[data.m],
            timestamp: data.t,
            seq: data.s,
            data: {
                value: data.d,
                delay: {
                    toServer: data.t - sednD.t,
                    toClient: Date.now() - data.t,
                    ping: this.data.ping,
                },
            },
            cost: data.c,
            hash: data.h,
        };
        return res;
    }
}
//# sourceMappingURL=transmitter.js.map