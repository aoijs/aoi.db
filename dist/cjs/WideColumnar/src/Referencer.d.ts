/// <reference types="node" />
import { WriteStream } from "fs";
import Referencer from "../../global/referencer.js";
import { ReferenceType } from "../../index.js";
import WideColumnarColumn from "./Column.js";
export default class WideColumnarReferencer extends Referencer {
    #private;
    cache: Record<string, {
        file: string;
        referenceFile: string;
        index: number;
    }>;
    files: {
        name: string;
        size: number;
        writer: WriteStream;
        index: number;
    }[];
    constructor(path: string, maxSize: number, type: ReferenceType, column: WideColumnarColumn);
    initialize(): Promise<void>;
    setReference(key: string, file: string): Promise<void>;
    getReference(): Promise<Record<string, {
        file: string;
        referenceFile: string;
        index: number;
    }>>;
}
//# sourceMappingURL=Referencer.d.ts.map