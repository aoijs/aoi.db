"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aoi_structures_1 = require("@aoijs/aoi.structures");
class LRUCache {
    capacity;
    cache;
    queue;
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();
        this.queue = new aoi_structures_1.PriorityQueue((a, b) => a.timestamp < b.timestamp);
    }
    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }
        const value = this.cache.get(key);
        this.updatePriority(key, Date.now());
        return value;
    }
    put(key, value) {
        if (this.cache.has(key)) {
            this.updatePriority(key, Date.now());
        }
        else {
            if (this.cache.size === this.capacity) {
                const evictedKey = this.queue.pop().key;
                this.cache.delete(evictedKey);
                this.cache.set(key, value);
                this.queue.push({ key, timestamp: Date.now() });
            }
        }
    }
    has(key) {
        return this.cache.has(key);
    }
    updatePriority(key, timestamp) {
        const oldEntry = this.queue.findFromProp((entry) => entry.key === key);
        if (oldEntry !== -1) {
            this.queue.replaceFromProp({ key, timestamp }, (data) => data.key === key);
        }
    }
    remove(key) {
        this.cache.delete(key);
        this.queue.removeByProp((entry) => entry.key === key);
    }
    clear() {
        this.cache.clear();
        this.queue._heap = [];
        this.queue._keyMap.clear();
    }
    all() {
        return Array.from(this.cache.values());
    }
    findOne(query) {
        return this.all().find(query);
    }
}
exports.default = LRUCache;
//# sourceMappingURL=LRUcache.js.map