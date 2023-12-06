import { WideColumnarTableOptions } from "../typings/interface.js";
import { ColumnType } from "../typings/types.js";
import WideColumnarColumn from "./Column.js";
import WideColumnar from "./Database.js";
export default class WideColumnarTable {
    #private;
    name: string;
    columns: WideColumnarColumn[];
    constructor(options: WideColumnarTableOptions);
    get db(): WideColumnar;
    get primary(): {
        name: string;
        type: ColumnType;
    };
}
//# sourceMappingURL=Table.d.ts.map