import {  KeyValueDataValueType } from "./type.js";
import { CacheType,ReferenceType} from "./enum.js";

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
    cache: CacheType;
    reference: ReferenceType;
    limit: number;
    sorted: boolean;
    sortFunction?: (a: any, b: any) => number;
}

export interface KeyValueTableOptions {
    name: string;

}

export interface KeyValueData {
    file: string;
    value:KeyValueDataValueType;
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

export interface CacherOptions {
    cache: CacheType;
    limit: number;
    sorted: boolean;
    sortFunction?: (a: any, b: any) => number;
    
}