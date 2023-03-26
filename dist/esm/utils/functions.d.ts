import { WsDBTypes } from "../typings/enums.js";
import { HashData, KeyValueJSONOption } from "../typings/interface.js";
import { KeyValueDataValueType, WideColumnDataValueType } from "../typings/type.js";
import { Transmitter } from "../ws/transmitter/database.js";
import { KeyValue } from "../keyvalue/database.js";
import { WideColumn } from "../column/database.js";
export declare function JSONParser<T>(readData: string): T;
export declare function encrypt(readData: string, securitykey: string): {
    iv: string;
    data: string;
};
export declare function decrypt(hash: HashData, securitykey: string): string;
export declare function encryptColumnData(data: string, securitykey: string, iv: string): string;
export declare function decryptColumnFile(readData: string, iv: string, securitykey: string): string;
export declare function stringify(data: WideColumnDataValueType | KeyValueDataValueType): string;
export declare function countFileLines(filePath: string): Promise<number>;
export declare function parseData(data: WideColumnDataValueType | KeyValueJSONOption, type: WsDBTypes): string | {
    type: string;
    value: string;
} | undefined;
export declare function convertFromDbdjsDbToAoiDb(data: {
    key: string;
    data: {
        key: string;
        value: any;
    };
}[], db: Transmitter | KeyValue | WideColumn): Promise<void>;
//# sourceMappingURL=functions.d.ts.map