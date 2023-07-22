"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
class Data {
    file;
    key;
    value;
    ttl;
    type;
    /**
     * @description create data
     * @param data data to create
     *
     * @memberof Data
     *
     * @example
     * ```js
     * const data = new Data({
     * file:"file",
     * key:"key",
     * value:"value",
     * ttl:1000,
     * type:"string"
     * })
     * ```
     */
    constructor(data) {
        this.file = data.file;
        this.key = data.key;
        this.type = data.type ?? this.#getType(data.value);
        this.value = this.#parseValue(data);
        this.ttl = data.ttl !== -1 && data.ttl ? Date.now() + data.ttl : -1;
    }
    /**
     * @private
     * @description get type of value
     * @param value value to get type
     * @returns
     */
    #getType(value) {
        return value instanceof Date ? "date" : typeof value;
    }
    /**
     * @private
     * @description parse value to correct type
     * @param data data to parse
     * @returns
     */
    #parseValue(data) {
        return data.type === "date" &&
            (typeof data.value === "string" ||
                typeof data.value === "number" ||
                util_1.types.isDate(data.value))
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
    /**
     * @description convert data to json
     * @returns
     * @memberof Data
     * @example
     * ```js
     * <KeyValueData>.toJSON()
     * ```
     */
    toJSON() {
        return {
            value: util_1.types.isDate(this.value)
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
    /**
     * @description create empty data
     * @static
     * @returns
     */
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
exports.default = Data;
//# sourceMappingURL=data.js.map