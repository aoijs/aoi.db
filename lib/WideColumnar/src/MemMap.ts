import { MemMapOptions } from "../typings/interface.js";
import { WideColumnarDataType } from "../typings/types.js";
import WideColumnarColumn from "./Column.js";
import WideColumnarData from "./Data.js";
import { serialize } from "v8";

export default class MemMap {
    heap : WideColumnarData[];
    #options: MemMapOptions;
    #column: WideColumnarColumn;    
    constructor(options: MemMapOptions,Column:WideColumnarColumn) {
        this.heap = [];
        this.#options = options;
        this.#column = Column;
    }
    async set(data: WideColumnarData) {
        if(this.heap.length >= this.#options.limit) {
            await this.flush();
        }
        this.heap.push(data);
        this.heap.sort(this.#options.sortFunction);
    }

    get(column:string,primary:WideColumnarDataType) {
        return this.heap.find(x => x.primary.value === primary && x.column.name === column);
    }
    has(column:string,primary:WideColumnarDataType) {
        return this.heap.some(x => x.primary.value === primary && x.column.name === column);
    }
    delete(column:string,primary:WideColumnarDataType) {
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
        const serialized = serialize(this.heap);
        return serialized.byteLength;
    }

    async flush() {
        // await this.#column.flush(this.heap);
        this.heap = [];
    }
}