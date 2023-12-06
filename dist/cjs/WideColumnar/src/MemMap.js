"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const v8_1 = require("v8");
class MemMap {
    heap;
    #options;
    #column;
    constructor(options, Column) {
        this.heap = [];
        this.#options = options;
        this.#column = Column;
    }
    async set(data) {
        if (this.heap.length >= this.#options.limit) {
            await this.flush();
        }
        this.heap.push(data);
        this.heap.sort(this.#options.sortFunction);
    }
    get(column, primary) {
        return this.heap.find(x => x.primary.value === primary && x.column.name === column);
    }
    has(column, primary) {
        return this.heap.some(x => x.primary.value === primary && x.column.name === column);
    }
    delete(column, primary) {
        const index = this.heap.findIndex(x => x.primary.value === primary && x.column.name === column);
        if (index !== -1) {
            this.heap.splice(index, 1);
        }
    }
    getHeap() {
        return this.heap;
    }
    getOptions() {
        return this.#options;
    }
    getSize() {
        const serialized = (0, v8_1.serialize)(this.heap);
        return serialized.byteLength;
    }
    async flush() {
        // await this.#column.flush(this.heap);
        this.heap = [];
    }
}
exports.default = MemMap;
//# sourceMappingURL=MemMap.js.map