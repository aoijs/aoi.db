"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_events_1 = __importDefault(require("node:events"));
const node_net_1 = require("node:net");
const index_js_1 = require("../../index.js");
class Receiver extends node_events_1.default {
    server;
    options;
    allowList = new Set();
    constructor(options) {
        super();
        this.options = options;
        this.server = (0, node_net_1.createServer)();
        this.server.listen(options.port, options.host, options.backlog, () => {
            this.emit(index_js_1.DatabaseEvents.Connect);
        });
    }
    allowAddress(address) {
        if (address === "*")
            this.allowList.add("*");
        else if ((0, node_net_1.isIPv4)(address)) {
            //convert it to ipv6
            const ipv6 = "::ffff:" + address;
            this.allowList.add(ipv6);
        }
        else if ((0, node_net_1.isIPv6)(address)) {
            this.allowList.add(address);
        }
        else {
            throw new Error("Invalid IP Address Provided");
        }
    }
    #bindEvents() {
        this.server.on("connection", (socket) => {
            socket.on("data", async (buffer) => {
                const data = this.transmitterDataFormat(buffer);
                if (data.op === index_js_1.DatabaseMethod.Set) {
                }
            });
        });
    }
    sendDataFormat(buffer) {
        const data = JSON.parse(buffer.toString());
        return {
            opCode: data.op,
            timestamp: data.t,
            seq: data.s,
            data: data.d,
            cost: data.c,
            hash: data.h,
            bucket: data.b,
        };
    }
    transmitterDataFormat(buffer) {
        return JSON.parse(buffer.toString());
    }
}
exports.default = Receiver;
//# sourceMappingURL=receiver.js.map