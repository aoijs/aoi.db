import { Group } from "@aoijs/aoi.structures";
import { serialize } from "v8";
export default class MemMap {
    heap;
    #options;
    #column;
    constructor(options, Column) {
        this.heap = new Group(Infinity);
        this.#options = options;
        this.#column = Column;
    }
    async set(data) {
        if (this.getSize() >= this.#options.limit) {
            await this.flush();
        }
        this.heap.set(data.primary.value, data);
    }
    get(primary) {
        return this.heap.get(primary);
    }
    has(primary) {
        return this.heap.has(primary);
    }
    delete(primary) {
        return this.heap.delete(primary);
    }
    getHeap() {
        return this.heap;
    }
    getOptions() {
        return this.#options;
    }
    getSize() {
        const serialized = serialize(this.heap);
        return serialized.byteLength;
    }
    async flush() {
        await this.#column.flush(this.heap.V());
        this.heap.clear();
    }
    findOne(query) {
        return this.heap.find(query);
    }
    findMany(query) {
        return this.heap.filter(query);
    }
}
//# sourceMappingURL=MemMap.js.map