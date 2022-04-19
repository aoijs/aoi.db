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

- [About](#about)

- [Examples](#examples)
  - [KeyValue](#keyvalue)
    - [Setup](#setup)
    - [BulkSet](#bulkset)
    - [Set](#set)
    - [Get](#get)
    - [Get All](#all)
    - [Delete](#delete)
    - [Clear](#clear)
    - [Ping](#ping)
    - [TablePing](#tableping)
- [Links](#links)

## About

aoi.db is a Database system with various database types meant for quick and easy storing datas.

## Examples

### KeyValue

#### Setup

<details> 
<summary>CJS</summary>

```js
const { KeyValue } = require("aoi.db");

const db = new KeyValue({
  path: "./database/",
  tables: ["test"],
});

db.once("ready", () => {
  console.log("Database ready!");
});

db.connect();
```

</details>
<details>
<summary>ESM</summary>

```js
import { KeyValue } from "aoi.db";

const db = new KeyValue({
  path: "./database/",
  tables: ["test"],
});

db.once("ready", () => {
  console.log("Database ready!");
});

db.connect();
```

</details>

#### BulkSet

```js
await db.bulkSet("test",{
  key : "Number", {
  value: 1,
}
},{
  key : "String", {
  value: "hello World",
}
});
```

#### Set

```js
await db.set("test", "Number", {
  value: 1,
});

await db.set("test", "String", {
  value: "hello World",
});

await db.set("test", "BigInt", {
  value: 2n,
}); // { value : 1 , type : "bigint" } || {value : BigInt("1223432") }

await db.set("test", "Boolean", {
  value: true,
});

await db.set("test", "Object", {
  value: { hello: "world" },
});

await db.set("test", "Arrays", {
  value: [1, 2, 3, 4, 5],
});

await db.set("test", "Date", {
  value: new Date(),
}); // { value : 1234565432 , type : "date" } || {value : "12/12/2022", type : "date" }

await db.set("test", "null", {
  value: null,
});
```

#### Get

```js
const string = await db.get("test", "String");
const numbers = await db.get("test", "Numbers");
```

#### All

```js
const lerefAndApple = await db.all("test", undefined, Infinity); // Setting limit as Infinity will return all data
```

#### Delete

```js
await db.delete("test", "fruits");
await db.delete("test", "leref");
```

#### Clear

```js
db.clear("test");
```

#### Ping

```js
db.ping;
```

#### TablePing

```js
db.tablePing("test");
```

## Links

aoi.db is created for [aoi.js](https://www.npmjs.com/aoi.js) but, it's available for anyone to learn and use.

- [Website](https://aoi.js.org)
- [Docs](https://leref.github.io/aoi.db/)
- [Discord Server](https://discord.com/invite/HMUfMXDQsV)
