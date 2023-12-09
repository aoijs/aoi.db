import { Group } from "@akarui/structures";
import { MemMapOptions } from "../typings/interface.js";
import { WideColumnarDataType } from "../typings/types.js";
import WideColumnarColumn from "./Column.js";
import WideColumnarData from "./Data.js";
import { serialize } from "v8";

export default class MemMap {
    heap : Group<WideColumnarData['primary']['value'],WideColumnarData>;
    #options: MemMapOptions;
    #column: WideColumnarColumn;    
    constructor(options: MemMapOptions,Column:WideColumnarColumn) {
        this.heap = new Group(Infinity);
        this.#options = options;
        this.#column = Column;
    }
    async set(data: WideColumnarData) {
        if(this.getSize()>= this.#options.limit) {
            await this.flush();
        }
        this.heap.set(data.primary.value, data);
    }

    get(primary:WideColumnarDataType) {
        return this.heap.get(primary);
    }
    has(primary:WideColumnarDataType) {
        return this.heap.has(primary);
    }
    delete(primary:WideColumnarDataType) {
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

    findOne(query: (data:WideColumnarData) => boolean) {
        return this.heap.find(query);
    }

    findMany(query: (data:WideColumnarData) => boolean) {
        return this.heap.filter(query);
    }
}