"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
class Data {
    file;
    key;
    value;
    type;
    deleted = false;
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
     * type:"string"
     * })
     * ```
     */
    constructor(data) {
        this.file = data.file;
        this.key = data.key;
        this.type = data.type ?? this.#getType(data.value);
        this.value = this.#parseValue(data);
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
                    : data.type === "boolean"
                        ? Boolean(data.value)
                        : data.type === "object"
                            ? (typeof data.value === "string" ? JSON.parse(data.value) : data.value)
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
            type: "undefined",
        });
    }
    static deletedData(key, file) {
        const data = Data.emptyData();
        data.key = key;
        data.deleted = true;
        data.file = file;
        return data;
    }
    static fromJSON(data, file) {
        return new Data({
            file,
            key: data.key,
            value: data.value,
            type: data.type,
        });
    }
}
exports.default = Data;
//# sourceMappingURL=Data.js.map