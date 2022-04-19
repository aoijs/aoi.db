"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WideColumnData = void 0;
const constants_js_1 = require("./constants.js");
class WideColumnData {
    primary;
    secondary;
    constructor({ primaryColumnName, primaryColumnValue, primaryColumnType, secondaryColumnName, secondaryColumnValue, secondaryColumnType, }) {
        (this.primary = {
            name: primaryColumnName,
            value: primaryColumnValue,
            type: primaryColumnType,
        }),
            (this.secondary = {
                name: secondaryColumnName,
                value: secondaryColumnValue,
                type: secondaryColumnType,
            });
    }
    toString() {
        return `${this.primary.value
            ?.toString()
            .replaceAll(constants_js_1.spaceConstant, "#COLUMNDATASPLITER#")}${constants_js_1.spaceConstant}${this.secondary.value
            ?.toString()
            .replaceAll(constants_js_1.spaceConstant, "#COLUMNDATASPLITER#")}`;
    }
    toJSON() {
        return {
            primary: {
                name: this.primary.name,
                value: this.primary.value,
                type: this.primary.type,
            },
            secondary: {
                name: this.secondary.name,
                value: this.secondary.value,
                type: this.secondary.type,
            },
        };
    }
}
exports.WideColumnData = WideColumnData;
//# sourceMappingURL=data.js.map