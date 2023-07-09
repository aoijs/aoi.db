import {  KeyValueDataValueType } from "./type.js";
import { CacheReferenceType } from "./enum.js";

export interface KeyValueOptions {
    dataConfig?: KeyValueDataConfig;
    fileConfig?: KeyValueFileConfig;
    encryptionConfig: KeyValueEncryptionConfig;
    cacheConfig?: KeyValueCacheConfig;
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
    cacheReference: CacheReferenceType;
    limit: number;
    sorted: boolean;
    sortFunction?: (a: any, b: any) => number;
}

export interface KeyValueTableOptions {
    name: string;

}

export interface KeyValueData {
    file: string;
    value:string;
    key:string;
    ttl:number;
    type:string;
}


export interface KeyValueJSONOption {
  value: KeyValueDataValueType;
  key: string;
  ttl: number;
  type: string;
} 