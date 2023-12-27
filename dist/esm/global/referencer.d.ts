/// <reference types="node" />
import { WriteStream } from "fs";
import { ReferenceType } from "../typings/enum.js";
import Table from "../KeyValue/src/newtable.js";
export default class Referencer {
    #private;
    cache: Record<string, {
        file: string;
        referenceFile: string;
    }>;
    cacheSize: number;
    files: {
        name: string;
        size: number;
        writer: WriteStream;
    }[];
    maxSize: number;
    type: ReferenceType;
    constructor(path: string, maxSize: number, type: ReferenceType);
    /**
     * Description initialize the Referencer
     * @returns
     */
    initialize(): Promise<void>;
    get path(): string;
    /**
     * @description get references
     * @returns
     *
     * @example
     * ```js
     * <Referencer>.getReference() // {key:{file:"file",referenceFile:"referenceFile"}}
     * ```
     */
    getReference(): Promise<Record<string, {
        file: string;
        referenceFile: string;
    }>>;
    /**
     * @description set reference
     * @param key key to set
     * @param file file to set
     *
     * @example
     *
     * ```js
     * <Referencer>.setReference("key","file")
     * ```
     */
    setReference(key: string, file: string): Promise<void>;
    /**
     * @description delete reference
     * @param key key to delete
     *
     * @example
     * ```js
     * <Referencer>.deleteReference("key")
     * ```
     */
    deleteReference(key: string): Promise<void>;
    /**
     * @description clear the Referencer
     *
     * @example
     * ```js
     * <Referencer>.clear()
     * ```
     */
    clear(): Promise<void>;
    /**
     * @description open the Referencer
     *
     * @example
     * ```js
     * <Referencer>.open()
     * ```
     */
    open(): void;
    /**
     * @description restart the Referencer
     *
     * @example
     * ```js
     * <Referencer>.restart()
     * ```
     */
    bulkDeleteReference(keys: string[]): Promise<void>;
    restart(): void;
    bulkSetReference(reference: Record<string, string>): Promise<void>;
    sync(files: string[], table: Table): Promise<void>;
}
//# sourceMappingURL=referencer.d.ts.map