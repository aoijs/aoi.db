import { Optional } from "../../typings/type.js";
import { KeyValueDataInterface, KeyValueJSONOption } from "../typings/interface.js";
import { types } from "util";
export default class Data {
    file: string;
    key: string;
    value: any;
    ttl?: number;
    type: string;

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

    constructor(data: Optional<KeyValueDataInterface, "type" >) {
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
    #getType(value: any) {
        return value instanceof Date ? "date" : typeof value;
    }
    /**
     * @private
     * @description parse value to correct type
     * @param data data to parse
     * @returns
     */
    #parseValue(data: Optional<KeyValueDataInterface, "type" >): any {
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
    /**
     * @description convert data to json
     * @returns
     * @memberof Data
     * @example
     * ```js
     * <KeyValueData>.toJSON()
     * ```
     */
    toJSON(): KeyValueJSONOption {
        return {
            value: types.isDate(this.value)
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
            type: "",
        });
    }
}
