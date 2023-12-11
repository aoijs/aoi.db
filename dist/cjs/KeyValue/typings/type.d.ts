export type DeepRequired<T> = {
    [K in keyof T]: DeepRequired<T[K]>;
} & Required<T>;
export type KeyValueTypeList = "string" | "bigint" | "number" | "null" | "boolean" | "object" | "date" | "symbol" | "undefined" | "function";
export type KeyValueDataValueType = string | bigint | number | null | boolean | Array<KeyValueDataValueType> | ValidJSON | Date;
export type ValidJSON = {
    [x: string | number | symbol]: ValidJSON | number | string | Array<ValidJSON> | null | boolean | (unknown & {
        toJSON(): ValidJSON;
    });
};
//# sourceMappingURL=type.d.ts.map