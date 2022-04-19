import { WideColumnDataValueType, WideColumnTypes } from "../typings/type.js";
export declare class WideColumnData {
    primary: {
        name: string;
        value: WideColumnDataValueType;
        type: WideColumnTypes;
    };
    secondary: {
        name: string;
        value: WideColumnDataValueType;
        type: WideColumnTypes;
    };
    constructor({ primaryColumnName, primaryColumnValue, primaryColumnType, secondaryColumnName, secondaryColumnValue, secondaryColumnType, }: {
        primaryColumnName: string;
        secondaryColumnName: string;
        primaryColumnValue: WideColumnDataValueType;
        secondaryColumnValue: WideColumnDataValueType;
        primaryColumnType: WideColumnTypes;
        secondaryColumnType: WideColumnTypes;
    });
    toString(): string;
    toJSON(): {
        primary: {
            name: string;
            value: WideColumnDataValueType;
            type: WideColumnTypes;
        };
        secondary: {
            name: string;
            value: WideColumnDataValueType;
            type: WideColumnTypes;
        };
    };
}
//# sourceMappingURL=data.d.ts.map