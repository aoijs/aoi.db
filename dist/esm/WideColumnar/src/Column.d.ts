import { WideColumnarColumnOptions } from "../typings/interface.js";
import { ColumnType } from "../typings/types.js";
export default class WideColumnarColumn {
    #private;
    name: string;
    primaryKey: boolean;
    default: any;
    type: ColumnType;
    constructor(options: WideColumnarColumnOptions);
}
//# sourceMappingURL=Column.d.ts.map