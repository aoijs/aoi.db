const { KeyValue, DatabaseEvents } = require("../../dist/cjs/index.js");
const { setTimeout: st } = require("timers/promises");

const db = new KeyValue({
  dataConfig: { path: "./database" },
  encryptionConfig: {
    encriptData: false,
    securityKey: "a-32-characters-long-string-here",
  },
  debug: true,
});
const keys = [];
const wait = async (ms) => await st(ms);

const methods = ["set", "get", "delete", "has", "all", "findOne", "findMany"];
db.on(DatabaseEvents.Connect, async () => {
  console.log("Connected to database");
  await wait(1000);
  await run();
});
db.connect();

async function measureOPS(fn, times) {
  const start = performance.now();
  for (let i = 0; i < times; i++) {
    await fn();
  }
  const end = performance.now();
  const time = end - start;
  const ops = (1000 * times) / time;
  return { time, ops, tpo: time / times };
}

async function set10k() {
  const fn = async () => {
    const key = `key-${Math.random()}`;
    keys.push(key);
    await db.set("main", key, { value: Math.random() });
  };

  return await measureOPS(fn, 10000);
}

async function get10k() {
  const fn = async () =>
    await db.get("main", keys[Math.floor(Math.random() * keys.length)]);
  return await measureOPS(fn, 10000);
}

async function delete10k() {
  const fn = async () => {
    const key = keys[Math.floor(Math.random() * keys.length)];
    keys.splice(keys.indexOf(key), 1);
    await db.delete("main", key);
  };
  return await measureOPS(fn, 10000);
}

async function has10k() {
  const fn = async () =>
    await db.has(
      "main",
      Math.random() > 0.5
        ? keys[Math.floor(Math.random() * keys.length)]
        : `key-${Math.random()}`
    );
  return await measureOPS(fn, 10000);
}

async function all10k() {
  const fn = async () => await db.all("main", () => true, 10, "desc");
  return await measureOPS(fn, 10000);
}

async function findOne10k() {
  const fn = async () => await db.findOne("main", () => true);
  return await measureOPS(fn, 10000);
}

async function findMany10k() {
  const fn = async () => await db.findMany("main", () => true);
  return await measureOPS(fn, 10000);
}

async function run() {
  const results = [];
  const cycles = 1;
  console.log("Running Suite...");

  for (let i = 0; i < cycles; i++) {
    console.log(`Cycle ${i + 1} of ${cycles}`);
    console.log("Running set10k...");
    const set = await set10k();
    console.log("Running get10k...");
    const get = await get10k();
    console.log("Running has10k...");
    const has = await has10k();
    // console.log("Running all10k...");
    // const all = await all10k();
    console.log("Running findOne10k...");
    const findOne = await findOne10k();
    // console.log("Running findMany10k...");
    // const findMany = await findMany10k();
    console.log("Running delete10k...");
    const del = await delete10k();

    results.push({
      set,
      get,
      del,
      has,
    //   all,
      findOne,
    //   findMany,
    });
  }
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const max = (arr) => Math.max(...arr);
  const min = (arr) => Math.min(...arr);
  const ops = (arr) => avg(arr.map((a) => a));

  const set = {
    time: parseFloat(avg(results.map((a) => a.set.time)).toFixed(2)),
    ops: Number(ops(results.map((a) => a.set.ops)).toFixed(0)),
    max: Number(max(results.map((a) => a.set.ops)).toFixed(0)),
    min: Number(min(results.map((a) => a.set.ops)).toFixed(0)),
    tpo: Number(avg(results.map((a) => a.set.tpo))),
  };

  const get = {
    time: parseFloat(avg(results.map((a) => a.get.time)).toFixed(2)),
    ops: Number(ops(results.map((a) => a.get.ops)).toFixed(0)),
    max: Number(max(results.map((a) => a.get.ops)).toFixed(0)),
    min: Number(min(results.map((a) => a.get.ops)).toFixed(0)),
    tpo: Number(avg(results.map((a) => a.get.tpo))),
  };

  const del = {
    time: parseFloat(avg(results.map((a) => a.del.time)).toFixed(2)),
    ops: Number(ops(results.map((a) => a.del.ops)).toFixed(0)),
    max: Number(max(results.map((a) => a.del.ops)).toFixed(0)),
    min: Number(min(results.map((a) => a.del.ops)).toFixed(0)),
    tpo: Number(avg(results.map((a) => a.del.tpo))),
  };

  const has = {
    time: parseFloat(avg(results.map((a) => a.has.time)).toFixed(2)),
    ops: Number(ops(results.map((a) => a.has.ops)).toFixed(0)),
    max: Number(max(results.map((a) => a.has.ops)).toFixed(0)),
    min: Number(min(results.map((a) => a.has.ops)).toFixed(0)),
    tpo: Number(avg(results.map((a) => a.has.tpo))),
  };

//   const all = {
//     time: parseFloat(avg(results.map((a) => a.all.time)).toFixed(2)),
//     ops: Number(ops(results.map((a) => a.all.ops)).toFixed(0)),
//     max: Number(max(results.map((a) => a.all.ops)).toFixed(0)),
//     min: Number(min(results.map((a) => a.all.ops)).toFixed(0)),
//     tpo: Number(avg(results.map((a) => a.all.tpo))),
//   };

  const findOne = {
    time: parseFloat(avg(results.map((a) => a.findOne.time)).toFixed(2)),
    ops: Number(ops(results.map((a) => a.findOne.ops)).toFixed(0)),
    max: Number(max(results.map((a) => a.findOne.ops)).toFixed(0)),
    min: Number(min(results.map((a) => a.findOne.ops)).toFixed(0)),
    tpo: Number(avg(results.map((a) => a.findOne.tpo))),
  };

//   const findMany = {
//     time: parseFloat(avg(results.map((a) => a.findMany.time)).toFixed(2)),
//     ops: Number(ops(results.map((a) => a.findMany.ops)).toFixed(0)),
//     max: Number(max(results.map((a) => a.findMany.ops)).toFixed(0)),
//     min: Number(min(results.map((a) => a.findMany.ops)).toFixed(0)),
//     tpo: Number(avg(results.map((a) => a.findMany.tpo))),
//   };

  const arr = {
    set,
    get,
    del,
    has,
    // all,
    findOne,
    // findMany,
  };
  console.table(arr);
}
