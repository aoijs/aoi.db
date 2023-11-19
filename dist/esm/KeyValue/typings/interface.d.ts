import { KeyValueDataValueType } from "./type.js";
import { CacheType, ReferenceType } from "../../typings/enum.js";
export interface KeyValueOptions {
    dataConfig?: KeyValueDataConfig;
    fileConfig?: KeyValueFileConfig;
    encryptionConfig: KeyValueEncryptionConfig;
    cacheConfig?: KeyValueCacheConfig;
    debug?: boolean;
}
export interface KeyValueDataConfig {
    path?: string;
    tables?: string[];
    referencePath?: string;
}
export interface KeyValueFileConfig {
    extension?: string;
    transactionLogPath?: string;
    maxSize?: number;
}
export interface KeyValueEncryptionConfig {
    securityKey: string;
    encriptData?: boolean;
}
export interface KeyValueCacheConfig {
    cache: CacheType;
    reference: ReferenceType;
    limit: number;
    sorted: boolean;
    sortFunction?: (a: any, b: any) => number;
}
export interface KeyValueTableOptions {
    name: string;
}
export interface KeyValueDataInterface {
    file: string;
    value: KeyValueDataValueType;
    key: string;
    type: string;
}
export interface KeyValueJSONOption {
    value: KeyValueDataValueType;
    key: string;
    type: string;
}
export interface CacherOptions {
    cache: CacheType;
    limit: number;
    sorted: boolean;
    sortFunction?: (a: any, b: any) => number;
}
//# sourceMappingURL=interface.d.ts.map