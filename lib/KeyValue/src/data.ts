import { Optional } from "../../typings/type.js";
import { KeyValueData, KeyValueJSONOption } from "../typings/interface.js";
import { types } from "util";
export default class Data {
    file: string;
    key: string;
    value: any;
    ttl?: number;
    type: string;

    constructor(data: Optional<KeyValueData, "type" | "ttl">) {
        this.file = data.file;
        this.key = data.key;
        this.type = data.type ?? this.#getType();
        this.value = this.#parseValue(data);
        this.ttl = data.ttl !== -1 && data.ttl ? Date.now() + data.ttl : -1;
    }
    #getType() {
        return this.value instanceof Date ? "date" : typeof this.value;
    }
    #parseValue(data: Optional<KeyValueData, "type" | "ttl">): any {
        return data.type === "date" &&
            (typeof data.value === "string" ||
                typeof data.value === "number" ||
                types.isDate(data.value))
            ? // @ts-ignore
              new Date(data.value)
            : data.type === "bigint" &&
              (typeof data.value === "string" || typeof data.value === "number")
            ? BigInt(data.value)
            : typeof data.value === "number" &&
              data.value > Number.MAX_SAFE_INTEGER
            ? BigInt(data.value)
            : data.value;
    }
    toJSON(): KeyValueJSONOption {
        return {
            value: types.isDate(this.value)
                ? this.value.toISOString()
                : typeof this.value === "bigint"
                ? this.value.toString()
                : this.value,
            type: this.type,
            key: this.key,
            ttl: this.ttl ?? -1,
        };
    }

    get size() {
        return Buffer.byteLength(JSON.stringify(this.toJSON()));
    }
    static emptyData() {
        return new Data({
            file: "",
            key: "",
            value: "",
            type: "",
            ttl: -1,
        });
    }
}
