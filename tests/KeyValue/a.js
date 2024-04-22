console.time("aaaa");

const { KeyValue, DatabaseEvents } = require("../../dist/cjs/index.js");
const { setTimeout: st } = require("timers/promises");
const db = new KeyValue({
    dataConfig: { path: "./database" , tables: ["main"] },
    encryptionConfig: {
        encriptData: false,
        securityKey: "a-32-characters-long-string-here",
    },
	fileConfig: {
		// reHashOnStartup: true,
		staticRehash:true,
		minFileCount:99,
	},
    debug: true,
});

db.on(DatabaseEvents.Connect, async () => {
    console.log("ready");
	console.timeEnd("aaaa");

	console.time("findMany")
	const data = await db.findMany("main", () => true);
	console.log(data.length)
	console.timeEnd("findMany")
	
});

db.connect();