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
    await st(1000);
  db.set("main","hello"+Math.random(),{value: Math.random()})
  db.set("main","hello"+Math.random(),{value: Math.random()})
  db.set("main","hello"+Math.random(),{value: Math.random()})
  db.set("main","hello"+Math.random(),{value: Math.random()})
  db.set("main","hello"+Math.random(),{value: Math.random()})
});

db.connect();