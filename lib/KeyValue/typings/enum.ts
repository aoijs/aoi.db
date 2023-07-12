export enum CacheType {
    LRU ,
    MRU ,
    LFU ,
    MFU ,
    FIFO ,
    FILO ,
}

export enum DatabaseMethod {
    Set,
    //Get,
    Delete,
    Flush,
    Clear,
    Replicate,
    Backup,
    Restore,
    NewFile,
}

export enum DatabaseEvents {
    Connect = "connect",
    Error = "error",
    Set = "set",
    Get = "get",
    Delete = "delete",
    Flush = "flush",
    Clear = "clear",
    Replicate = "replicate",
    Backup = "backup",
    Restore = "restore",
    Disconnect = "disconnect",
    TableReady = "tableReady",
}

export enum ReferenceType {
    Cache,
    File,
}