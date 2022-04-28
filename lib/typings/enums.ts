export enum DatabaseEvents {
  READY = "ready",
  TABLE_READY = "tableReady",
  DEBUG = "debug",
  DISCONNECT = "disconnect",
}
export enum TransmitterFlags {
  READ_ONLY = "readOnly",
  WRITE_ONLY = "writeOnly",
  READ_WRITE = "readWrite",
}

export enum ReceiverOp {
  ACK_CONNECTION,
  ACK_SET,
  ACK_GET,
  ACK_DELETE,
  ACK_ALL,
  ACK_PING,
  ACK_TABLES,
  ACK_COLUMNS,
  ACK_ROWS,
  ERROR,
  ACK_CACHE,
}

export enum TransmitterOp {
  REQUEST,
  CONNECTION,
  TABLE_OPEN,
  TABLE_CLOSE,
  COLUMN_OPEN,
  COLUMN_CLOSE,
  ROW_OPEN,
  ROW_CLOSE,
  BULK_TABLE_OPEN,
  BULK_TABLE_CLOSE,
  BULK_COLUMN_OPEN,
  BULK_COLUMN_CLOSE,
  BULK_ROW_OPEN,
  BULK_ROW_CLOSE,
  SET,
  GET,
  DELETE,
  ALL,
  PING,
  LOGS,
  TABLES,
  COLUMNS,
  ROWS,
  REQUEST_CACHE,
}

export enum WsEventsList {
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  ERROR = "error",
  OPEN = "open",
  MESSAGE = "message",
  CLOSE = "close",
  READY = "ready",
}
