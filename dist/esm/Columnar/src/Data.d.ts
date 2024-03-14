import { ColumnDataInterface } from "../typings/interface.js";
export default class ColumnData {
    primary: ColumnDataInterface;
    column: ColumnDataInterface;
    constructor(primary: ColumnDataInterface, column: ColumnDataInterface);
    toString(): string;
    toJSON(): {
        primary: ColumnDataInterface;
        column: ColumnDataInterface;
    };
}
//# sourceMappingURL=Data.d.ts.map