import { WsDBTypes } from "../typings/enums.js";
import { HashData, KeyValueJSONOption } from "../typings/interface.js";
import { WideColumnDataValueType } from "../typings/type.js";
export declare function JSONParser<T>(readData: string): T;
export declare function encrypt(readData: string, securitykey: string): {
    iv: string;
    data: string;
};
export declare function decrypt(hash: HashData, securitykey: string): string;
export declare function encryptColumnData(data: string, securitykey: string, iv: string): string;
export declare function decryptColumnFile(readData: string, iv: string, securitykey: string): string;
export declare function stringify(data: WideColumnDataValueType): string;
export declare function countFileLines(filePath: string): Promise<number>;
export declare function parseData(data: WideColumnDataValueType | KeyValueJSONOption, type: WsDBTypes): string | {
    type: string;
    value: string | undefined;
} | undefined;
//# sourceMappingURL=functions.d.ts.map