import { Optional } from "../../typings/type.js";
import { KeyValueData, KeyValueJSONOption } from "../typings/interface.js";
export default class Data {
    #private;
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
     * ttl:1000,
     * type:"string"
     * })
     * ```
     */
    constructor(data: Optional<KeyValueData, "type" | "ttl">);
    /**
     * @description convert data to json
     * @returns
     * @memberof Data
     * @example
     * ```js
     * <KeyValueData>.toJSON()
     * ```
     */
    toJSON(): KeyValueJSONOption;
    get size(): number;
    /**
     * @description create empty data
     * @static
     * @returns
     */
    static emptyData(): Data;
}
//# sourceMappingURL=data.d.ts.map