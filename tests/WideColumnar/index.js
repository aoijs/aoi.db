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
                        type: "string",
                        primaryKey: true,
                        default: "1",
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
const keys = [];
let i = 0;
const key = "key";

db.on(DatabaseEvents.Connect, async () => {
    console.log("ready");
    await wait(2000);
    // while (i < 100) {
    //     if (!keys.length) {
    //         const newKey = key + i++;
    //         keys.push(newKey);
    //         console.log(
    //             "method: ",
    //             "set",
    //             "value: ",
    //             await db.set(
    //                 "main",
    //                 { name: "key", value: newKey },
    //                 { name: "id", value: "1" },
    //             ),
    //         );
    //     } else {
    //         const method = methods[Math.floor(Math.random() * methods.length)];
    //         if (method === "set") {
    //             const newKey = key + i++;
    //             keys.push(newKey);
    //             console.log(
    //                 "method: ",
    //                 method,
    //                 "value: ",
    //                 await db.set(
    //                     "main",
    //                     { name: "key", value: newKey },
    //                     { name: "id", value: newKey },
    //                 ),
    //             );
    //         } else if (method === "get") {
    //             const key = keys[Math.floor(Math.random() * keys.length)];
    //             console.log(
    //                 "method: ",
    //                 method,
    //                 "value: ",
    //                 await db.get("main", "key", key),
    //             );
    //         } else if (method === "delete") {
    //             const key = keys[Math.floor(Math.random() * keys.length)];
    //             keys.splice(keys.indexOf(key), 1);
    //             console.log(
    //                 "method: ",
    //                 method,
    //                 "value: ",
    //                 await db.delete("main", "key", key),
    //                 "key: ",
    //                 key,
    //             );
    //         } else if (method === "has") {
    //             const key = keys[Math.floor(Math.random() * keys.length)];
    //             console.log(
    //                 "method: ",
    //                 method,
    //                 "value: ",
    //                 await db.has("main", "key", key),
    //             );
    //         } else if (method === "all") {
    //             console.log(
    //                 "method: ",
    //                 method,
    //                 "value: ",
    //                 await db.all("main","key", () => true,10),
    //             );
    //         } else if (method === "findOne") {
    //             console.log(
    //                 "method: ",
    //                 method,
    //                 "value: ",
    //                 await db.findOne("main", "key", () => true),
    //             );
    //         } else if (method === "findMany") {
    //             console.log(
    //                 "method: ",
    //                 method,
    //                 "value: ",
    //                 await db.findMany("main", "key", () => true),
    //             );
    //         }
    //     }
    //     await wait(100);
    // }

    for(let i = 0; i < 10000; i++) {
        await db.set("main", {
            name: "key",
            value: `key-${Math.random()}`,
        }, {
            name: "id",
            value: Math.random(),
        });
    }
    console.log(await db.findMany("main", "key", () => true));
    
});

db.connect();
