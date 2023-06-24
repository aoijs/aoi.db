<h1 align="center">@akarui/aoi.db</h1>

<div align="center">

[![Discord Server](https://img.shields.io/discord/773352845738115102?color=5865F2&logo=discord&logoColor=white)](https://discord.com/invite/HMUfMXDQsV)
[![NPM Downloads](https://img.shields.io/npm/dt/aoi.db.svg?maxAge=3600)](https://www.npmjs.com/package/aoi.db)
[![NPM Version](https://img.shields.io/npm/v/aoi.db.svg?maxAge=3600)](https://www.npmjs.com/package/aoi.db)

</div>

## Table Of Contents

- [Table Of Contents](#table-of-contents)
- [About](#about)
- [Installation](#installation)
- [Types](#types)
- [Setups](#setups)
  - [KeyValue](#keyvalue)
  - [WideColumn](#widecolumn)
  - [Remote](#remote)
    - [Setting up the database server](#setting-up-the-database-server)
    - [Setting up the client](#setting-up-the-client)
- [Links](#links)

## About
Aoi.db is a collection of various database types to handle various types of data requirements!

## Installation

```bash
#npm 
npm i @akarui/aoi.db

#yarn
yarn add @akarui/aoi.db
```

## Types

> * KeyValue - A simple database that stores key value pairs
>   * Usage:  general purpose 

>
> * WideColumn - A database that stores data in a column 
>   * Usage:  good for getting separate columns related to a primary column 
>

>
> * Remote - A database that stores data in a remote server
>   * Usage:  good for separating database extensive usage from main project/process
>

## Setups

### KeyValue

```ts
  const { KeyValue } = require("@akarui/aoi.db") //commonjs
  // or
  import { KeyValue } from "@akarui/aoi.db" //esm

  // Basic Setup
  const db = new KeyValue({
    path: "./path/",
    tables: ["table"],
  });

  db.on("ready", () => {
    console.log("Database is ready!");
  });

  db.connect();

```
Reference: [KeyValue](https://akaruidevelopment.github.io/aoi.db/classes/KeyValue.html)

### WideColumn

```ts
  const { WideColumn, Column } = require("@akarui/aoi.db") //commonjs
  // or
  import { WideColumn, Column } from "@akarui/aoi.db" //esm

  // Basic Setup

  const prime = new Column({
    name: "id",
    primary: true,
    type: "bigint",
    default:0n,
  });
  const xp = new Column({
    name: "xp",
    type: "number",
    primary: false,
    sortOrder: "DESC",
    default : 0,
  });

  const db = new WideColumn({
    path: "./path/",
    encryptOption: {
      securitykey: "a-32-characters-long-string-here",
    },
    tables: [
      {
        name: "main",
        columns: [prime, xp ],
      },
    ],
  });

  db.on("ready", () => {
    console.log("Database is ready!");
  });

  db.connect();

```
Reference: [WideColumn](https://akaruidevelopment.github.io/aoi.db/classes/WideColumn.html)


### Remote

#### Setting up the database server

```js
const { Receiver } = require("@akarui/aoi.db"); //commonjs
// or
import { Receiver } from "@akarui/aoi.db"; //esm

const rec = new Receiver({
  logEncrypt: "a-32-characters-long-string-here",
  logPath: "./logPath/",
  wsOptions: {
    port: portNo, // 443 for ssl wss and 80 for ws
    clientTracking: true,
  },
  whitelistedIps: "*",
});

rec.on("connect", () => {
  console.log("connected");
});

rec.connect();

```
Reference: [Receiver](https://akaruidevelopment.github.io/aoi.db/classes/Receiver.html)

#### Setting up the client

```js

const { Transmitter, TransmitterFlags } = require("@akarui/aoi.db"); //commonjs
// or
import { Transmitter, TransmitterFlags } from "@akarui/aoi.db"; //esm

const db = new Transmitter({
  path: "websocket path",
  //path : "ws://localhost:80",
  databaseType: "KeyValue or WideColumn",
  dbOptions: {
    path: "./databasePath in remote server/",
    encryptOption: {
      securitykey: "a-32-characters-long-string-here",
      enabled: true,
    },
  },
  name: "username",
  pass: "password",
  flags: TransmitterFlags.READ_WRITE, //READ_WRITE, READ_ONLY, WRITE_ONLY
  tables: ["table"],
});

db.on("ready", () => {
  console.log("ready");
});
db.on("close", (code, reason) => {
  console.log("[TRANSMITTER] => " + code + " " + reason);
});
db.connect();
```
Reference: [Transmitter](https://akaruidevelopment.github.io/aoi.db/classes/Transmitter.html)


## Links

- [Documentation](https://akaruidevelopment.github.io/aoi.db/)
- [Discord Server](https://discord.com/invite/HMUfMXDQsV)
- [NPM](https://www.npmjs.com/package/@akarui/aoi.db)
- [Github](https://github.com/Akaruidevelopment/aoi.db)
