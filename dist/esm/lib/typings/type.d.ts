/// <reference types="node" />
export declare type KeyValueDataValueType = string | bigint | number | null | boolean | Array<KeyValueDataValueType> | ValidJSON | Date;
export declare type ValidJSON = {
    [x: string | number | symbol]: ValidJSON | number | string | Array<ValidJSON> | null | boolean | (unknown & {
        toJSON(): ValidJSON;
    });
};
export declare type CacheReferenceType = "MEMORY" | "DISK";
export declare type WideColumnTypes = "string" | "number" | "boolean" | "bigint" | "object" | "date" | "buffer" | "stream";
export declare type WideColumnDataValueType = string | number | boolean | null | Date | Buffer | bigint | object | ReadableStream;
export declare type RelationalDataValueType = string | number | object | BigBuffer | Date | boolean;
export declare type BigBuffer = Buffer | ArrayBuffer | bigint | Blob | ReadableStream;
export declare type ReceiverTypes = "connection" | "bulkTableOpened" | "bulkTableClosed";
//# sourceMappingURL=type.d.ts.map