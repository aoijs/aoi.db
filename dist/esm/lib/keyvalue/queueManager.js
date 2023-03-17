import { Cacher } from "./cacher.js";
export class KeyValueQueue {
    queue;
    queued;
    constructor() {
        this.queue = {
            set: new Map(),
            get: new Map(),
            delete: new Map(),
            all: new Cacher({
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
//# sourceMappingURL=queueManager.js.map