"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyValueQueue = void 0;
const cacher_js_1 = require("./cacher.js");
class KeyValueQueue {
    queue;
    queued;
    constructor() {
        this.queue = {
            set: new Map(),
            get: new Map(),
            delete: new Map(),
            all: new cacher_js_1.Cacher({
                limit: Infinity,
                sorted: true,
            }),
        };
        this.queued = {
            set: false,
            get: false,
            delete: false,
            all: false,
        };
    }
    addToQueue(method, path, key, value) {
        if (!this.queue[method].get(path)) {
            if (method === "set") {
                if (!value)
                    return;
                this.queue[method].set(path, new Map());
                this.queue[method].get(path)?.set(key, value);
            }
            else if (method === "get") {
                this.queue[method].set(path, {});
                const data = this.queue[method].get(path);
                if (!value)
                    return;
                if (!data)
                    return;
                else
                    data[key] = value;
            }
            else {
                this.queue[method].set(path, new Set());
                this.queue[method].get(path)?.add(key);
            }
        }
        else {
            if (method === "set") {
                if (!value)
                    return;
                this.queue[method].get(path)?.set(key, value);
            }
            else if (method === "get") {
                const data = this.queue[method].get(path);
                if (!value)
                    return;
                if (!data)
                    return;
                else
                    data[key] = value;
            }
            else {
                this.queue[method].get(path)?.add(key);
            }
        }
    }
    deletePathFromQueue(method, path) {
        return this.queue[method].delete(path);
    }
}
exports.KeyValueQueue = KeyValueQueue;
//# sourceMappingURL=queueManager.js.map