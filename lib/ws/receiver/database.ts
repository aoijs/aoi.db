import { randomBytes } from "crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import {
  ReceiverOp,
  TransmitterFlags,
  TransmitterOp,
  WsDBTypes,
  WsEventsList as ReceiverEvents,
} from "../../typings/enums.js";
import {
  ColumnDatabaseOptions,
  ColumnTableOptions,
  HashData,
  KeyValueDatabaseOption,
  ReceiverData,
  ReceiverOptions,
  SocketData,
  WsEvents,
} from "../../typings/interface.js";
import {
  decrypt,
  encrypt,
  encryptColumnData,
  JSONParser,
} from "../../utils/functions.js";

function heartbeat(socket: ws) {
  //@ts-ignore
  socket.isAlive = true;
}

export class Receiver extends TypedEmitter<WsEvents> {
  logData: {
    currentLogFile: string;
    logs: Record<string, string>;
    path: string;
    key: string;
  };
  connection: ws.Server;
  options: ReceiverOptions;
  clients: Map<string, SocketData> = new Map();
  _ping: number = -1;
  lastPingTimestamp: number = -1;
  _currentSequence: number = 0;
  #interval!: NodeJS.Timer;
  constructor(options: ReceiverOptions) {
    super();
    this.connection = new ws.Server(options.wsOptions);
    this.options = options;
    this.logData = {
      currentLogFile: "",
      logs: {},
      path: this.options.logPath ?? "./logs/",
      key: this.options.logEncrypt,
    };
  }
  connect() {
    if (!existsSync(this.logData.path)) {
      mkdirSync(this.logData.path, { recursive: true });
      const iv = randomBytes(16).toString("hex");
      writeFileSync(this.logData.path + "1_1000.log", iv);
      this.logData.logs["1_1000.log"] = iv;
      this.logData.currentLogFile = this.logData.path + "1_1000.log";
    } else {
      const files = readdirSync(this.logData.path).sort(
        (a, b) => Number(a.split("_")[0]) - Number(b.split("_")[0]),
      );
      this.logData.currentLogFile = files.pop() ?? "";
      files.forEach((x) => {
        const iv = readFileSync(`${this.logData.path}/${x}`)
          .toString()
          .split("\n")[0];
        this.logData.logs[x] = iv;
      });
    }
    this.#clearDeadClients();

    this.connection.on("connection", (socket, request) => {
      //@ts-ignore
      socket.isAlive = true;
      socket.on("pong", () => heartbeat(socket));

      if (
        this.options.whitelistedIps !== "*" &&
        this.options.whitelistedIps.indexOf(
          request.socket.remoteAddress || "",
        ) === -1
      ) {
        socket.close(3000, "Ip Not Whitelisted");
        return;
      }
      this.emit(ReceiverEvents.CONNECT);
      socket.on("open", () => {});
      socket.on("message", async (data: string) => {
        const parsedData = JSON.parse(data);
        this.emit(ReceiverEvents.MESSAGE, parsedData);
        if (parsedData.op === TransmitterOp.REQUEST) {
          let data: SocketData;
          if (parsedData.d.dbType === WsDBTypes.KeyValue) {
            const path = `name:${parsedData.d.name}@pass:${
              parsedData.d.pass
            }@path:${parsedData.d.options.path ?? "./database/"}@type:${
              parsedData.d.dbType
            }`;
            const hash = encrypt(path, this.logData.key);

            console.log({ options: parsedData.d.options });
            if (existsSync(parsedData.d.options.path)) {
              const readData = JSONParser<HashData>(
                readFileSync(
                  parsedData.d.options.path + "owner.hsh",
                ).toString(),
              );
              const decrypted = decrypt(readData, this.logData.key);

              if (decrypted !== path) {
                const [_name, _pass, _path, _type] = decrypted.split("@");
                
                if (
                  `name:${parsedData.d.name}` === _name &&
                  `pass:${parsedData.d.pass}` !== _pass &&
                  `path:${parsedData.d.options.path}` === _path &&
                  `type:${parsedData.d.dbType}` === _type
                ) {

                  socket.close(3000, "Wrong Password");
                  return;
                } else if (
                  `name:${parsedData.d.name}` === _name &&
                  `pass:${parsedData.d.pass}` === _pass &&
                  `path:${parsedData.d.options.path}` === _path &&
                  `type:${parsedData.d.dbType}` !== _type
                ) {
                  socket.close(3000, "Wrong Type");
                  return;
                } else if (
                  `name:${parsedData.d.name}` === _name &&
                  `pass:${parsedData.d.pass}` === _pass &&
                  `path:${parsedData.d.options.path}` !== _path
                ) {
                  parsedData.d.options.path = parsedData.d.options.path + "_1";
                }
              }
            }
            data = {
              databaseType: WsDBTypes.KeyValue,
              db: new KeyValue(<KeyValueDatabaseOption>parsedData.d.options),
            };
            data.db.connect();
            if (!existsSync(parsedData.d.options.path + "/owner.hsh")) {
              writeFileSync(
                data.db.options.path + "/owner.hsh",
                JSON.stringify(hash),
              );
            }
            this.clients.set(<string>request.socket.remoteAddress, data);
          } else {
            data = {
              databaseType: WsDBTypes.WideColumn,
              db: new WideColumn(<ColumnDatabaseOptions>parsedData.d.options),
            };
            this.clients.set(<string>request.socket.remoteAddress, data);
          }
          this._currentSequence += 1;
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_CONNECTION,
            db: data.databaseType,
            d: null,
            t: Date.now(),
            s: this._currentSequence,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.PING) {
          const sk = <SocketData>(
            this.clients.get(<string>request.socket.remoteAddress)
          );
          this.lastPingTimestamp = Date.now();
          this._currentSequence += 1;
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_PING,
            s: this._currentSequence,
            t: Date.now(),
            db: sk.databaseType,
            d: null,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.BULK_TABLE_OPEN) {
          this.load(request.socket.remoteAddress || socket.url, parsedData.d);
          const sk = <SocketData>(
            this.clients.get(<string>request.socket.remoteAddress)
          );
          this._currentSequence += 1;
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_TABLES,
            s: this._currentSequence,
            t: Date.now(),
            db: sk.databaseType,
            d: null,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.SET) {
          const sk = <SocketData>(
            this.clients.get(request.socket.remoteAddress || socket.url)
          );
          if (sk?.flags === TransmitterFlags.READ_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              s: this._currentSequence,
              t: Date.now(),
              db: sk.databaseType,
              d: "Database is read only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          this._currentSequence += 1;
          const start = performance.now();
          await sk.db.set(
            parsedData.d.table,
            parsedData.d.key,
            parsedData.d.data,
          );
          const end = performance.now()- start;
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_SET,
            s: this._currentSequence,
            t: Date.now(),
            db: sk.databaseType,
            d: null,
            a:end,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.GET) {
          this._currentSequence += 1;
          const sk = <SocketData>(
            this.clients.get(<string>request.socket.remoteAddress)
          );
          if (sk?.flags === TransmitterFlags.WRITE_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              s: this._currentSequence,
              t: Date.now(),
              db: sk.databaseType,
              d: "Database is write only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          let get;
          let searchTime;
          if (sk.databaseType === WsDBTypes.KeyValue) {
            const db = <KeyValue>sk.db;
            const start = performance.now();
            get = await db.get(parsedData.d.table, parsedData.d.key);
            searchTime = performance.now() - start;
          } else {
            const db = <WideColumn>sk.db;
            const start = performance.now();
            get = await db.get(
              parsedData.d.table,
              parsedData.d.key,
              parsedData.d.primary,
            );
            searchTime = performance.now() - start;
          }
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_GET,
            s: this._currentSequence,
            t: Date.now(),
            db: sk.databaseType,
            d: get,
            a:searchTime,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.DELETE) {
          const sk = <SocketData>(
            this.clients.get(request.socket.remoteAddress || socket.url)
          );
          if (sk?.flags === TransmitterFlags.READ_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              s: this._currentSequence,
              t: Date.now(),
              db: sk.databaseType,
              d: "Database is read only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          this._currentSequence += 1;
          let searchTime;
          if (sk.databaseType === WsDBTypes.KeyValue) {
            const start = performance.now();
            await (<KeyValue>sk.db).delete(
              parsedData.d.table,
              parsedData.d.key,
            );
            searchTime = performance.now() - start;
          } else if (sk.databaseType === WsDBTypes.WideColumn) {
            const start = performance.now();
            await (<WideColumn>sk.db).delete(
              parsedData.d.table,
              parsedData.d.key,
              parsedData.d.primary,
            );
            searchTime = performance.now() - start;
          }
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_DELETE,
            s: this._currentSequence,
            t: Date.now(),
            db: sk.databaseType,
            d: null,
            a:searchTime,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.ALL) {
          const sk = <SocketData>(
            this.clients.get(request.socket.remoteAddress || socket.url)
          );
          if (sk?.flags === TransmitterFlags.WRITE_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              s: this._currentSequence,
              t: Date.now(),
              db: sk.databaseType,
              d: "Database is write only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          this._currentSequence += 1;
          let all;
          let searchTime;
          if (sk?.databaseType === WsDBTypes.KeyValue) {
            const start = performance.now();
            all = await (<KeyValue>sk.db).all(
              parsedData.d.table,
              parsedData.d.filter,
              parsedData.d.limit,
              parsedData.d.sortOrder,
            );
            searchTime = performance.now() - start;
          } else if (sk?.databaseType === WsDBTypes.WideColumn) {
            const start = performance.now();
            all = await (parsedData.d.column
              ? (<WideColumn>sk.db).all(
                  parsedData.d.table,
                  parsedData.d.column,
                  parsedData.d.filter,
                  parsedData.d.limit,
                )
              : (<WideColumn>sk.db).allData(parsedData.d.table));
            searchTime = performance.now() - start;
          }
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_ALL,
            s: this._currentSequence,
            t: Date.now(),
            db: sk?.databaseType,
            d: all,
            a:searchTime,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.CLEAR) {
          const sk = <SocketData>(
            this.clients.get(request.socket.remoteAddress || socket.url)
          );
          if (sk?.flags === TransmitterFlags.READ_ONLY) {
            const sendData: ReceiverData = {
              op: ReceiverOp.ERROR,
              s: this._currentSequence,
              t: Date.now(),
              db: sk.databaseType,
              d: "Database is read only",
            };
            socket.send(JSON.stringify(sendData));
            return;
          }
          this._currentSequence += 1;
          let searchTime;
          if (sk?.databaseType === WsDBTypes.KeyValue) {
            const start = performance.now();
            (<KeyValue>sk.db).clear(parsedData.d.table);
            searchTime = performance.now() - start;
          } else if (sk.databaseType === WsDBTypes.WideColumn) {
            const start = performance.now();
            if (!parsedData.d.column) {
              (<WideColumn>sk.db).clearTable(parsedData.d.table);
            } else {
              (<WideColumn>sk.db).clearColumn(
                parsedData.d.table,
                parsedData.d.column,
              );
            }
            searchTime = performance.now() - start;
          }
          const sendData: ReceiverData = {
            op: ReceiverOp.ACK_CLEAR,
            s: this._currentSequence,
            t: Date.now(),
            db: sk?.databaseType,
            d: null,
            a:searchTime,
          };
          socket.send(JSON.stringify(sendData));
        } else if (parsedData.op === TransmitterOp.LOGS) {
        }
      });
      socket.on("close", () => {
        this.clients.delete(<string>request.socket.remoteAddress);
      });
    });
    this.connection.on("close", () => {
      clearInterval(this.#interval);
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
      ...(<SocketData>this.clients.get(socket)),
      tables,
      flags,
    });
  }
  logSequence(socket: string, sequence: number, data: object) {
    const key = this.options.logEncrypt;
    if (!key) throw new Error("Log Encryption key not set");
  }
  #clearDeadClients() {
    this.#interval = setInterval(() => {
      this.connection.clients.forEach((ws) => {
        // @ts-ignore
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        // @ts-ignore
        ws.isAlive = false;
        ws.ping();
      });
    }, 41250);
  }
}
