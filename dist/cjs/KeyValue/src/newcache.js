"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const aoi_structures_1 = require("@aoijs/aoi.structures");
const data_js_1 = __importDefault(require("./data.js"));
class Cacher extends aoi_structures_1.Group {
    #cacherOptions;
    constructor(options) {
        super(options.limit);
        this.#cacherOptions = options;
    }
    bulkFileSet(data, file) {
        for (const key in data) {
            const d = new data_js_1.default({
                ...data[key],
                file,
            });
            this.set(key, d);
        }
    }
    removeDuplicates() {
        const arr = this.V();
        this.clear();
        for (const data of arr) {
            this.set(data.key, data);
        }
    }
}
exports.default = Cacher;
//# sourceMappingURL=newcache.js.map