import { KeyValueOptions } from "../../KeyValue/typings/interface.js";
import { KeyValueData } from "../../index.js";
export type DatabaseOptions<Type extends PossibleDatabaseTypes> = Type extends "KeyValue" ? KeyValueOptions : never;
export type Key<Type extends PossibleDatabaseTypes> = Type extends "KeyValue" ? KeyValueData["key"] : never;
export type Value<Type extends PossibleDatabaseTypes> = Type extends "KeyValue" ? KeyValueData["value"] : never;
export type PossibleDatabaseTypes = "KeyValue";
export type TransmitterQuery = {
    value?: any;
    key?: string;
    ttl?: number;
    "||": TransmitterQuery;
    "&&": TransmitterQuery;
    "!=": TransmitterQuery;
    '>': TransmitterQuery;
    '<': TransmitterQuery;
    '>=': TransmitterQuery;
    '<=': TransmitterQuery;
    "$sw": TransmitterQuery;
    "$ew": TransmitterQuery;
    "$i": TransmitterQuery;
    "$re": TransmitterQuery;
};
//# sourceMappingURL=type.d.ts.map