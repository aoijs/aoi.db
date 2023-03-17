export class WideColumnQueue {
    queue;
    queued;
    constructor() {
        this.queue = {
            get: new Map(),
            delete: new Map(),
        };
        this.queued = {
            get: false,
            delete: false,
        };
    }
    addToQueue(method, path, key, value) {
        if (method === "get") {
            if (this.queue.get.has(path))
                this.queue[method].set(path, new Map());
            if (!value)
                return;
            this.queue[method].get(path)?.set(key, value);
        }
        else {
            if (!this.queue.delete.has(path))
                this.queue[method].set(path, new Set());
            this.queue[method].get(path)?.add(key);
        }
    }
    deletePathFromQueue(method, path) {
        return this.queue[method].delete(path);
    }
}
//# sourceMappingURL=queueManager.js.map