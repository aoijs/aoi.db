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

db.on(DatabaseEvents.Connect, async () => {
    console.log("ready");
    await st(2000);
  console.log((await db.all("main",data => data.key.startsWith("collection"))).length);
  await st(2000);
  console.log(await db.get("main", "collection_641161618729992203"));
    console.log((await db.all("main",data => data.key.startsWith("collection"))).length);
});

db.connect();