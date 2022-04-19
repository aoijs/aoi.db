import { spaceConstant } from "./constants.js";
export class WideColumnData {
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
            .replaceAll(spaceConstant, "#COLUMNDATASPLITER#")}${spaceConstant}${this.secondary.value
            ?.toString()
            .replaceAll(spaceConstant, "#COLUMNDATASPLITER#")}`;
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
//# sourceMappingURL=data.js.map