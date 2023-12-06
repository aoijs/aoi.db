"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class WideColumnarData {
    primary;
    column;
    constructor(data) {
        this.primary = data.primary;
        this.column = data.column;
    }
    toString() {
        return JSON.stringify(this.toJSON());
    }
    toJSON() {
        return {
            primary: this.primary,
            column: this.column
        };
    }
}
exports.default = WideColumnarData;
//# sourceMappingURL=Data.js.map