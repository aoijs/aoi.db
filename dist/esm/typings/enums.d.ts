export declare enum DatabaseEvents {
    READY = "ready",
    TABLE_READY = "tableReady",
    DEBUG = "debug",
    DISCONNECT = "disconnect"
}
export declare enum TransmitterFlags {
    READ_ONLY = "readOnly",
    WRITE_ONLY = "writeOnly",
    READ_WRITE = "readWrite"
}
export declare enum ReceiverOp {
    ACK_CONNECTION = 0,
    ACK_SET = 1,
    ACK_GET = 2,
    ACK_DELETE = 3,
    ACK_ALL = 4,
    ACK_PING = 5,
    ACK_TABLES = 6,
    ACK_COLUMNS = 7,
    ACK_ROWS = 8,
    ERROR = 9,
    ACK_CACHE = 10,
    ACK_CLEAR = 11,
    ACK_LOGS = 12,
    ACK_ANALYZE = 13
}
export declare enum TransmitterOp {
    REQUEST = 0,
    CONNECTION = 1,
    TABLE_OPEN = 2,
    TABLE_CLOSE = 3,
    COLUMN_OPEN = 4,
    COLUMN_CLOSE = 5,
    ROW_OPEN = 6,
    ROW_CLOSE = 7,
    BULK_TABLE_OPEN = 8,
    BULK_TABLE_CLOSE = 9,
    BULK_COLUMN_OPEN = 10,
    BULK_COLUMN_CLOSE = 11,
    BULK_ROW_OPEN = 12,
    BULK_ROW_CLOSE = 13,
    SET = 14,
    GET = 15,
    DELETE = 16,
    CLEAR = 17,
    ALL = 18,
    PING = 19,
    LOGS = 20,
    TABLES = 21,
    COLUMNS = 22,
    ROWS = 23,
    REQUEST_CACHE = 24,
    ANALYZE = 25
}
export declare enum WsEventsList {
    CONNECT = "connect",
    DISCONNECT = "disconnect",
    ERROR = "error",
    OPEN = "open",
    MESSAGE = "message",
    CLOSE = "close",
    READY = "ready"
}
export declare enum WsDBTypes {
    KeyValue = 0,
    WideColumn = 1,
    Relational = 2
}
export declare const TransmitterDBTypes: ["KeyValue", "WideColumn", "Relational"];
//# sourceMappingURL=enums.d.ts.map