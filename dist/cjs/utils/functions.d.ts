import { HashData } from "../typings/interface";
import { WideColumnDataValueType } from "../typings/type";
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
//# sourceMappingURL=functions.d.ts.map