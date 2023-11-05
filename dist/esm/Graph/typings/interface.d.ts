import { CacheType, ReferenceType } from "../../index.js";
import { GraphDBDataValueType } from "./type.js";
export interface GrpahDBConfig {
    dataConfig?: GraphDBDataConfig;
    fileConfig?: GraphDBFileConfig;
    encryptionConfig: GraphDBEncryptionConfig;
    cacheConfig?: GraphDBCacheConfig;
}
export interface GraphDBDataConfig {
    path?: string;
    tables?: string[];
    referencePath?: string;
}
export interface GraphDBFileConfig {
    extension?: string;
    transactionLogPath?: string;
    maxSize?: number;
}
export interface GraphDBEncryptionConfig {
    securityKey: string;
    encriptData?: boolean;
}
export interface GraphDBCacheConfig {
    cache: CacheType;
    reference: ReferenceType;
    limit: number;
    sorted: boolean;
    sortFunction?: (a: any, b: any) => number;
}
export interface GraphDBTableOptions {
    name: string;
}
export interface GraphDBDataInterface {
    file: string;
    value: GraphDBDataValueType;
    key: string;
    ttl: number;
    type: string;
}
export interface GraphDBJSONOption {
    value: GraphDBDataValueType;
    key: string;
    ttl: number;
    type: string;
}
export interface CacherOptions {
    cache: CacheType;
    limit: number;
    sorted: boolean;
    sortFunction?: (a: any, b: any) => number;
}
//# sourceMappingURL=interface.d.ts.map