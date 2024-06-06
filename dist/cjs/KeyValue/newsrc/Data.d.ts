import { Optional } from "../../typings/type.js";
import { KeyValueTypeList } from "../typings/type.js";
import { KeyValueDataInterface, KeyValueJSONOption } from "../typings/interface.js";
export default class Data {
    #private;
    file: string;
    key: string;
    value: any;
    type: KeyValueTypeList;
    deleted: boolean;
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
    constructor(data: Optional<KeyValueDataInterface, "type">);
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
    static deletedData(key: string, file: string): Data;
    static fromJSON(data: KeyValueJSONOption, file: string): Data;
}
//# sourceMappingURL=Data.d.ts.map