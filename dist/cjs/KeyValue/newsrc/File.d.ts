/**
 ** json file
 ** max keys 10k
 **
 */
import { IJSONOptions, KeyValueJSONOption } from "./typings/interface.js";
import Data from "./Data.js";
export default class JSONFile {
    #private;
    constructor(options: IJSONOptions);
    open(): Promise<void>;
    set(data: Data[]): Promise<void>;
    get(key: string): Promise<Data | null>;
    findMany(query: (data: KeyValueJSONOption) => boolean): Promise<Data[]>;
    findOne(query: (data: KeyValueJSONOption) => boolean): Promise<Data | null>;
    all(query: (data: KeyValueJSONOption) => boolean, order?: "asc" | "desc" | "firstN", start?: number, length?: number): Promise<Data[]>;
}
//# sourceMappingURL=File.d.ts.map