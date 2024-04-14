const { KeyValue, DatabaseEvents } = require("../../dist/cjs/index.js");
const { setTimeout: st } = require("timers/promises");
const db = new KeyValue({
    dataConfig: { path: "./database" },
    encryptionConfig: {
        encriptData: false,
        securityKey: "a-32-characters-long-string-here",
    },
	fileConfig: {
		reHashOnStartup: true,
	},
    debug: true,
});

db.on(DatabaseEvents.Connect, async () => {
    console.log("ready");
    await st(1000);
    for(let i =0;i < 200000;i++) {
        await db.set("main", "key" + i, { value: 1 });
    }
console.log("done")
    console.log(await db.get("main","key50000"))
    console.log(await db.findOne("main",dt => dt.key.startsWith("key50000")))
});

db.connect();