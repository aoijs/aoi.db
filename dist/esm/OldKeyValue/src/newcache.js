import { Group } from "@akarui/structures";
import Data from "./data.js";
export default class Cacher extends Group {
    #cacherOptions;
    constructor(options) {
        super(options.limit);
        this.#cacherOptions = options;
    }
    bulkFileSet(data, file) {
        for (const key in data) {
            const d = new Data({
                ...data[key],
                file,
            });
            this.set(key, d);
        }
    }
}
//# sourceMappingURL=newcache.js.map