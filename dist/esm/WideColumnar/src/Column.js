"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class WideColumnarColumn {
    name;
    primaryKey;
    default;
    type;
    constructor(options) {
        this.name = options.name;
        this.primaryKey = options.primaryKey;
        this.default = options.default;
        this.type = options.type;
        if (!this.primaryKey && this.default === undefined)
            throw new Error("Default value is required for non primary key columns");
    }
    #initialize() {
    }
}
exports.default = WideColumnarColumn;
//# sourceMappingURL=Column.js.map