import { Hash } from "./typings/interface.js";
import { KeyValue } from "./KeyValue/index.js";
import { ColumnType } from "./WideColumnar/index.js";
export declare function encrypt(string: string, key: string, iV?: string): Hash;
export declare function decrypt(hash: Hash, key: string): string;
export declare const ReferenceConstantSpace: string;
export declare function createHashRawString(strings: string[]): string;
export declare function createHash(string: string, key: string, iv: string): string;
export declare function decodeHash(hash: string, key: string, iv: string): string[];
export declare function JSONParser(data: string): {
    data: any;
    isBroken: boolean;
};
export declare function convertV1KeyValuetov2(oldDbFolder: string, db: KeyValue): Promise<void>;
export declare function checkIfTargetPresentInBitWiseOr(num: number, target: number): boolean;
export declare function stringify(data: any): any;
export declare function parse(data: string, type: ColumnType): any;
//# sourceMappingURL=utils.d.ts.map