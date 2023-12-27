"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
class QueueManager {
    // @ts-ignore
    #set = {
        data: [],
        size: 0,
    };
    #delete = {
        data: [],
        size: 0,
    };
    add(data) {
        if (data instanceof index_js_1.KeyValueData) {
            this.#set.data.push(data);
            this.#set.size += data.size;
            this.#set[data.file] = (this.#set[data.file] || 0) + data.size;
        }
        else {
            this.#delete.data.push(data);
            this.#delete.size += data.key.length;
        }
    }
    clear(type) {
        // @ts-ignore
        if (type === "set")
            this.#set = { data: [], size: 0 };
        //@ts-ignore
        else
            this.#delete = { data: [], size: 0 };
    }
    get(type) {
        // @ts-ignore
        if (type === "set")
            return this.#set;
        //@ts-ignore
        else
            return this.#delete;
    }
    has(type, key) {
        return type === "set"
            ? this.#set.data.some((data) => data.key === key)
            : this.#delete.data.some((data) => data.key === key);
    }
    remove(type, key) {
        if (type === "set") {
            const index = this.#set.data.findIndex((data) => data.key === key);
            if (index !== -1) {
                const data = this.#set.data.splice(index, 1)[0];
                this.#set.size -= data.size;
                this.#set[data.file] -= data.size;
            }
        }
        else {
            const index = this.#delete.data.findIndex((data) => data.key === key);
            if (index !== -1) {
                const data = this.#delete.data.splice(index, 1)[0];
                this.#delete.size -= data.key.length;
            }
        }
    }
    getQueueSize(type) {
        if (type == "set")
            return this.#set.size;
        else
            return this.#delete.size;
    }
}
exports.default = QueueManager;
//# sourceMappingURL=queue.js.map