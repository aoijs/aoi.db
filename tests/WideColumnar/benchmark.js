const { WideColumnar, DatabaseEvents } = require("../../dist/cjs/index.js");
const { setTimeout: st } = require("timers/promises");
const db = new WideColumnar({
    dataConfig: {
        path: "./__tests__/wdatabase",
        tables: [
            {
                name: "main",
                columns: [
                    {
                        name: "key",
                        type: "string",
                        primaryKey: false,
                        default: "1",
                    },
                    {
                        name: "id",
                        type: "number",
                        primaryKey: true,
                        default: 1,
                    },
                ],
            },
        ],
    },
    encryptionConfig: {
        securityKey: "a-32-characters-long-string-here",
    },
    debug: true,
});

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
    const ops = (times * 1000) / time;
    return { time, ops: ops, tpo: time / times };
}

async function setFunc() {
    const fn = async () =>
        await db.set(
            "main",
            {
                name: "key",
                value: `key-${Math.random()}`,
            },
            {
                name: "id",
                value: Math.random(),
            },
        );
    return await measureOPS(fn, 500);
}

async function getFunc() {
    const fn = async () => await db.get("main", "key", Math.random());
    return await measureOPS(fn, 500);
}

async function deleteFunc() {
    const fn = async () => await db.delete("main", "key", Math.random());
    return await measureOPS(fn, 500);
}

async function hasFunc() {
    const fn = async () => await db.has("main", "key", Math.random());
    return await measureOPS(fn, 500);
}

async function allFunc() {
    const fn = async () => await db.all("main", "key", () => true, 10);
    return await measureOPS(fn, 500);
}

async function findOneFunc() {
    const fn = async () => await db.findOne("main", "key", () => true);
    return await measureOPS(fn, 500);
}

async function findManyFunc() {
    const fn = async () => await db.findMany("main", "key", () => true);
    return await measureOPS(fn, 500);
}

async function run() {
    const results = [];
    const cycles = 5;
    console.log("Running Suite...");

    for (let i = 0; i < cycles; i++) {
        console.log(`Cycle ${i + 1} of ${cycles}`);
        const set = await setFunc();
        // console.log("Added 10k rows to database");
        const get = await getFunc();
        // console.log("Got 10k rows from database");
        const all = await allFunc();
        // console.log("All 10k rows from database");
        const del = await deleteFunc();
        // console.log("Deleted 10k rows from database");
        const has = await hasFunc();
        // console.log("Checked 10k rows from database");

        const findOne = await findOneFunc();
        // console.log("Found 10k rows from database");
        const findMany = await findManyFunc();
        // console.log("Found 10k rows from database");

        results.push({
            set,
            get,
            del,
            has,
            all,
            findOne,
            findMany,
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
        tpo: Number(ops(results.map((a) => a.set.tpo))),
    };

    const get = {
        time: parseFloat(avg(results.map((a) => a.get.time)).toFixed(2)),
        ops: Number(ops(results.map((a) => a.get.ops)).toFixed(0)),
        max: Number(max(results.map((a) => a.get.ops)).toFixed(0)),
        min: Number(min(results.map((a) => a.get.ops)).toFixed(0)),
        tpo: Number(ops(results.map((a) => a.get.tpo))),
    };

    const del = {
        time: parseFloat(avg(results.map((a) => a.del.time)).toFixed(2)),
        ops: Number(ops(results.map((a) => a.del.ops)).toFixed(0)),
        max: Number(max(results.map((a) => a.del.ops)).toFixed(0)),
        min: Number(min(results.map((a) => a.del.ops)).toFixed(0)),
        tpo: Number(ops(results.map((a) => a.del.tpo))),
    };

    const has = {
        time: parseFloat(avg(results.map((a) => a.has.time)).toFixed(2)),
        ops: Number(ops(results.map((a) => a.has.ops)).toFixed(0)),
        max: Number(max(results.map((a) => a.has.ops)).toFixed(0)),
        min: Number(min(results.map((a) => a.has.ops)).toFixed(0)),
        tpo: Number(ops(results.map((a) => a.has.tpo))),
    };

    const all = {
        time: parseFloat(avg(results.map((a) => a.all.time)).toFixed(2)),
        ops: Number(ops(results.map((a) => a.all.ops)).toFixed(0)),
        max: Number(max(results.map((a) => a.all.ops)).toFixed(0)),
        min: Number(min(results.map((a) => a.all.ops)).toFixed(0)),
        tpo: Number(ops(results.map((a) => a.all.tpo))),
    };

    const findOne = {
        time: parseFloat(avg(results.map((a) => a.findOne.time)).toFixed(2)),
        ops: Number(ops(results.map((a) => a.findOne.ops)).toFixed(0)),
        max: Number(max(results.map((a) => a.findOne.ops)).toFixed(0)),
        min: Number(min(results.map((a) => a.findOne.ops)).toFixed(0)),
        tpo: Number(ops(results.map((a) => a.findOne.tpo))),
    };

    const findMany = {
        time: parseFloat(avg(results.map((a) => a.findMany.time)).toFixed(2)),
        ops: Number(ops(results.map((a) => a.findMany.ops)).toFixed(0)),
        max: Number(max(results.map((a) => a.findMany.ops)).toFixed(0)),
        min: Number(min(results.map((a) => a.findMany.ops)).toFixed(0)),
        tpo: Number(ops(results.map((a) => a.findMany.tpo))),
    };

    const arr = {
        set,
        get,
        del,
        has,
        all,
        findOne,
        findMany,
    };
    console.table(arr);
}
