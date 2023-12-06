import { WideColumnarColumnOptions } from "../typings/interface.js";
import { ColumnType, WideColumnarDataType } from "../typings/types.js";
import MemMap from "./MemMap.js";
import WideColumnarTable from "./Table.js";
export default class WideColumnarColumn {
    #private;
    name: string;
    primaryKey: boolean;
    default: any;
    type: ColumnType;
    path: string;
    files: string[];
    table: WideColumnarTable;
    memMap: MemMap;
    constructor(options: WideColumnarColumnOptions);
    setPath(path: string): void;
    setFiles(): void;
    setTable(table: WideColumnarTable): void;
    initialize(): Promise<void>;
    set(primary: WideColumnarDataType, value: WideColumnarDataType): void;
}
//# sourceMappingURL=Column.d.ts.map