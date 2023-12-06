"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Column_js_1 = __importDefault(require("./Column.js"));
class WideColumnarTable {
    name;
    columns;
    #db;
    #primary;
    constructor(options) {
        this.name = options.name;
        this.#parseColumns(options.columns);
        this.#db = options.db;
    }
    #parseColumns(columns) {
        for (const column of columns) {
            if (!(column instanceof Column_js_1.default)) {
                const col = new Column_js_1.default(column);
                col.setTable(this);
                this.columns.push(col);
                if (col.primaryKey) {
                    if (this.#primary) {
                        throw new Error("Multiple primary keys are not allowed");
                    }
                    this.#primary = {
                        name: col.name,
                        type: col.type,
                    };
                }
            }
        }
    }
    get db() {
        return this.#db;
    }
    get primary() {
        return this.#primary;
    }
}
exports.default = WideColumnarTable;
//# sourceMappingURL=Table.js.map