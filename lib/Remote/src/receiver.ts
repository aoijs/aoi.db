import EventEmitter from "node:events";
import {  Server, createServer,isIPv4,isIPv6 } from "node:net";
import {
    ReceiverDataFormat,
    ReceiverOptions,
    TransmitterDataFormat,
} from "../typings/interface.js";
import { DatabaseEvents, DatabaseMethod } from "../../index.js";
import { randomBytes } from "node:crypto";

export default class Receiver extends EventEmitter {
    server: Server;
    options: ReceiverOptions;
    allowList: Set<string> = new Set();

    constructor(options: ReceiverOptions) {
        super();
        this.options = options;
        this.server = createServer();
        this.server.listen(options.port, options.host, options.backlog, () => {
            this.emit(DatabaseEvents.Connect);
        });
    }

    allowAddress(address: string) {
        if (address === "*") this.allowList.add("*");
        else if (isIPv4(address)) {
            //convert it to ipv6
            const ipv6 = "::ffff:" + address;
            this.allowList.add(ipv6);
        } else if (isIPv6(address)) {
            this.allowList.add(address);
        } else {
            throw new Error("Invalid IP Address Provided");
        }
    }

    #bindEvents() {
        this.server.on("connection", (socket) => {
            socket.on("data", async(buffer) => {
                const data = this.transmitterDataFormat(buffer);
                if(data.op === DatabaseMethod.Set) {

                }
            });
        });
    }
    sendDataFormat(buffer: Buffer) {
        const data = JSON.parse(buffer.toString());
        return {
            opCode: data.op,
            timestamp: data.t,
            seq: data.s,
            data: data.d,
            cost: data.c,
            hash: data.h,
            bucket: data.b,
        } as ReceiverDataFormat;
    }
    transmitterDataFormat(
       buffer : Buffer
    ) {
        return JSON.parse(buffer.toString()) as TransmitterDataFormat;
    }


}