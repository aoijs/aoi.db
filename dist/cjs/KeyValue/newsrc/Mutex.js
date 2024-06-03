"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Mutex {
    #lock;
    #queue;
    constructor() {
        this.#lock = false;
        this.#queue = [];
    }
    async lock() {
        return new Promise((resolve) => {
            if (!this.#lock) {
                this.#lock = true;
                resolve();
                return;
            }
            this.#queue.push(resolve);
        });
    }
    unlock() {
        if (this.#queue.length > 0) {
            const resolve = this.#queue.shift();
            resolve();
            return;
        }
        this.#lock = false;
    }
    isLocked() {
        return this.#lock;
    }
}
exports.default = Mutex;
//# sourceMappingURL=Mutex.js.map