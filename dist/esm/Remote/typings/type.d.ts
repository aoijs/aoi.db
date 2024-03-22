import { KeyValueOptions } from "../../KeyValue/typings/interface.js";
import { KeyValueData } from "../../index.js";
export type DatabaseOptions<Type extends PossibleDatabaseTypes> = Type extends "KeyValue" ? KeyValueOptions : never;
export type Key<Type extends PossibleDatabaseTypes> = Type extends "KeyValue" ? KeyValueData["key"] : never;
export type Value<Type extends PossibleDatabaseTypes> = Type extends "KeyValue" ? KeyValueData["value"] : never;
export type PossibleDatabaseTypes = "KeyValue";
//# sourceMappingURL=type.d.ts.map