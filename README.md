<p align="center">
  <a href="https://discord.com/invite/HMUfMXDQsV">
    <img width="200" src="https://cdn.discordapp.com/attachments/927071950461890580/966111722245091388/68747470733a2f2f63646e2e646973636f72646170702e636f6d2f6174746163686d656e74732f3830343831333936313139303537323039332f3932343736353630363035363730313935322f616f6974732e706e67.png">
  </a>
</p>

<h1 align="center">aoi.db</h1>

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
npm i aoi.db

#yarn
yarn add aoi.db

#edge

npm i https://github.com/leref/aoi.db#main
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
  const { KeyValue } = require("aoi.db") //commonjs
  // or
  import { KeyValue } from "aoi.db" //esm

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
Reference: [KeyValue](https://leref.github.io/aoi.db/classes/KeyValue.html)

### WideColumn

```ts
  const { WideColumn, Column } = require("aoi.db") //commonjs
  // or
  import { WideColumn, Column } from "aoi.db" //esm

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
Reference: [WideColumn](https://leref.github.io/aoi.db/classes/WideColumn.html)


### Remote

#### Setting up the database server

```js
const { Receiver } = require("aoi.db"); //commonjs
// or
import { Receiver } from "aoi.db"; //esm

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
Reference: [Receiver](https://leref.github.io/aoi.db/classes/Receiver.html)

#### Setting up the client

```js

const { Transmitter, TransmitterFlags } = require("aoi.db"); //commonjs
// or
import { Transmitter, TransmitterFlags } from "aoi.db"; //esm

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
Reference: [Transmitter](https://leref.github.io/aoi.db/classes/Transmitter.html)


## Links

- [Documentation](https://leref.github.io/aoi.db/)
- [Discord Server](https://discord.com/invite/HMUfMXDQsV)
- [NPM](https://www.npmjs.com/package/aoi.db)
- [Github](https://github.com/leref/aoi.db)
