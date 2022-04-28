import { existsSync, writeFileSync } from "fs";
import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import {
  ReceiverOp,
  TransmitterFlags,
  TransmitterOp,
} from "../../typings/enums.js";
import {
  ColumnDatabaseOptions,
  ColumnTableOptions,
  KeyValueDatabaseOption,
  ReceiverData,
  ReceiverOptions,
} from "../../typings/interface.js";

export class Receiver {
  connection: ws.Server;
  options: ReceiverOptions;
  clients: Map<
    string,
    { tables?: string[] | ColumnTableOptions[]; flags?: TransmitterFlags }
  > = new Map();
  _ping: number = -1;
  lastPingTimestamp: number = -1;
  _currentSequence: number = 0;
  db: KeyValue | WideColumn;
  databaseType: "KeyValue" | "WideColumn";
  constructor(options: ReceiverOptions) {
    this.connection = new ws.Server(options.wsOptions);
    this.options = options;
    this.databaseType = options.databaseType;
    if (this.databaseType === "KeyValue") {
      this.db = new KeyValue(<KeyValueDatabaseOption>options.dbOptions);
    } else {
      this.db = new WideColumn(<ColumnDatabaseOptions>options.dbOptions);
    }
    this.db.connect();
  }
  connect() {
    this.connection.on("connection", (socket, request) => {
      if (
        this.options.whitelistedIps !== "*" &&
        this.options.whitelistedIps.indexOf(
          request.socket.remoteAddress || "",
        ) === -1
      ) {
        socket.close(3000, "Ip Not Whitelisted");
        return;
      }
      this.clients.set(request.socket.remoteAddress || socket.url, {});
      socket.on("message", async (data: string) => {
        const parsedData = JSON.parse(data);
        if (parsedData.op === TransmitterOp.REQUEST) {
          this._currentSequence += 1;
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_CONNECTION,
            databaseType: this.databaseType,
            data: "Request Accepted",
            timestamp: Date.now(),
            sequence: this._currentSequence,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.PING) {
          this.lastPingTimestamp = Date.now();
          this._currentSequence += 1;
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_PING,
            sequence: this._currentSequence,
            timestamp: Date.now(),
            databaseType: this.databaseType,
            data: "Ping Acknowledged",
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.BULK_TABLE_OPEN) {
          this.load(
            request.socket.remoteAddress || socket.url,
            parsedData.data,
          );
        } else if (parsedData.op === TransmitterOp.SET) {
          const sk = this.clients.get(
            request.socket.remoteAddress || socket.url,
          );
          if (sk?.flags === TransmitterFlags.READ_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              sequence: this._currentSequence,
              timestamp: Date.now(),
              databaseType: this.databaseType,
              data: "Database is read only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          this._currentSequence += 1;
          await this.db.set(
            parsedData.data.table,
            parsedData.data.key,
            parsedData.data.data,
          );
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_SET,
            sequence: this._currentSequence,
            timestamp: Date.now(),
            databaseType: this.databaseType,
            data: "Set Acknowledged",
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.GET) {
          this._currentSequence += 1;
          const sk = this.clients.get(
            request.socket.remoteAddress || socket.url,
          );
          if (sk?.flags === TransmitterFlags.WRITE_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              sequence: this._currentSequence,
              timestamp: Date.now(),
              databaseType: this.databaseType,
              data: "Database is write only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          let get;
          if (this.databaseType === "KeyValue") {
            const db = <KeyValue>this.db;
            get = await db.get(parsedData.data.table, parsedData.data.key);
          } else {
            const db = <WideColumn>this.db;
            get = await db.get(
              parsedData.data.table,
              parsedData.data.key,
              parsedData.data.primary,
            );
          }
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_GET,
            sequence: this._currentSequence,
            timestamp: Date.now(),
            databaseType: this.databaseType,
            data: get,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.DELETE) {
          const sk = this.clients.get(
            request.socket.remoteAddress || socket.url,
          );
          if (sk?.flags === TransmitterFlags.READ_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              sequence: this._currentSequence,
              timestamp: Date.now(),
              databaseType: this.databaseType,
              data: "Database is read only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          this._currentSequence += 1;
          if (this.databaseType === "KeyValue") {
            await (<KeyValue>this.db).delete(
              parsedData.data.table,
              parsedData.data.key,
            );
          } else if (this.databaseType === "WideColumn") {
            await (<WideColumn>this.db).delete(
              parsedData.data.table,
              parsedData.data.key,
              parsedData.data.primary,
            );
          }
        } else if (parsedData.op === TransmitterOp.ALL) {
          const sk = this.clients.get(
            request.socket.remoteAddress || socket.url,
          );
          if (sk?.flags === TransmitterFlags.READ_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              sequence: this._currentSequence,
              timestamp: Date.now(),
              databaseType: this.databaseType,
              data: "Database is read only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          this._currentSequence += 1;
          let all;
          if (this.databaseType === "KeyValue") {
            all = await (<KeyValue>this.db).all(parsedData.data.table);
          } else if (this.databaseType === "WideColumn") {
            all = await (parsedData.data.column
              ? (<WideColumn>this.db).all(
                  parsedData.data.table,
                  parsedData.data.column,
                  parsedData.data.filter,
                  parsedData.data.limit,
                )
              : (<WideColumn>this.db).allData(parsedData.data.table));
          }
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_ALL,
            sequence: this._currentSequence,
            timestamp: Date.now(),
            databaseType: this.databaseType,
            data: all,
          };
          socket.send(JSON.stringify(sendData));
        }
      });
    });
  }
  load(
    socket: string,
    {
      tables,
      flags,
    }: {
      tables: string[] | ColumnTableOptions[];
      flags: TransmitterFlags;
    },
  ) {
    this.clients.set(socket, {
      tables,
      flags,
    });
  }
}
