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


export enum ReceiverOp
{
  ACK_CONNECTION = "ackConnection",
  ACK_SET = "ackSet",
  ACK_GET = "ackGet",
  ACK_DELETE = "ackDelete",
  ACK_ALL = "ackAll",
  ACK_PING = "ackPing",
  ACK_TABLES = "ackTables",
  ACK_COLUMNS = "ackColumns",
  ACK_ROWS = "ackRows",
  ERROR = "error",
  ACK_CACHE = "ackCache",
}

export enum TransmitterOp {
  REQUEST = "request",
  SET = "set",
  GET = "get",
  DELETE = "delete",
  ALL = "all",
  PING = "ping",
  LOGS = "logs",
  TABLES = "tables",
  COLUMNS = "columns",
  ROWS = "rows",
  REQUEST_CACHE = "requestCache",
  CONNECTION = "connection",
  TABLE_OPEN = "tableOpen",
  TABLE_CLOSE = "tableClose",
  COLUMN_OPEN = "columnOpen",
  COLUMN_CLOSE = "columnClose",
  ROW_OPEN = "rowOpen",
  ROW_CLOSE = "rowClose",
  BULK_TABLE_OPEN = "bulkTableOpen",
  BULK_TABLE_CLOSE = "bulkTableClose",
  BULK_COLUMN_OPEN = "bulkColumnOpen",
  BULK_COLUMN_CLOSE = "bulkColumnClose",
  BULK_ROW_OPEN = "bulkRowOpen",
  BULK_ROW_CLOSE = "bulkRowClose",
}