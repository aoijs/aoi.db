"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_js_1 = require("../../utils.js");
const v8_1 = require("v8");
class ColumnData {
    primary;
    column;
    constructor(primary, column) {
        this.primary = primary;
        this.column = column;
    }
    toString() {
        const bufflist = [
            (0, v8_1.serialize)(this.primary.value).toString("hex"),
            (0, v8_1.serialize)(this.column.value).toString("hex"),
        ];
        return bufflist.join(utils_js_1.ReferenceConstantSpace);
    }
    toJSON() {
        return {
            primary: this.primary,
            column: this.column,
        };
    }
}
exports.default = ColumnData;
//# sourceMappingURL=Data.js.map