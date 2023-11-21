const { KeyValue, DatabaseEvents } = require("../../dist/cjs/index.js");
const { setTimeout : st } = require("timers/promises");
const db = new KeyValue({
    dataConfig: { path: "./__tests__/database", },
    encryptionConfig: {
        encriptData: false,
    },
    debug:true,
});
console.log(db.options)

const wait = async ms => await st(ms);

db.on(DatabaseEvents.Connect, async () => {
    console.log("ready");
    console.time("add");
    await Add10k();
    console.timeEnd("add");

    await wait(2000);

    await db.backup();



    // console.time("get");
    // await get10k();
    // console.timeEnd("get");

    // await wait(2000);

    // console.time("all");
    // await all10k();
    // console.timeEnd("all");

    // await wait(2000);

    // console.time("findOne");
    // await findOne10k();
    // console.timeEnd("findOne");

    // await wait(2000);

    // console.time("findMany");
    // await FindMany10k();
    // console.timeEnd("findMany");

    // await wait(2000);

    // console.time("delete");
    // await delete10k();
    // console.timeEnd("delete");

})

db.connect();

async function Add10k() {
    for (let i = 0; i < 10000; i++) {
        await db.tables.main.table.set(`key${i}`, {
            value: i,
        });
    }
}

async function get10k() {
    for (let i = 0; i < 10000; i++) {
        await db.tables.main.table.get(
            `key${Math.floor(Math.random() * 10000)}`,
        );
    }
}

async function delete10k() {
    for (let i = 0; i < 10000; i++) {
        await db.tables.main.table.delete(`key${i}`);
    }
}

async function all10k() {
    for (let i = 0; i < 10000; i++) {
        await db.tables.main.table.all();
    }
}

async function findOne10k() {
    for (let i = 0; i < 10000; i++) {
        await db.tables.main.table.findOne(
            (v) => v.value >= Math.floor(Math.random() * 10000),
        );
    }
}

async function FindMany10k() {
    for (let i = 0; i < 10000; i++) {
        await db.tables.main.table.findMany(
            (v) => v.value > Math.floor(Math.random() * 10000),
        );
    }
}

 