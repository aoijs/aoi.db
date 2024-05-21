const { OldKeyValue, DatabaseEvents } = require("../../dist/cjs/index.js");
const { setTimeout: st } = require("timers/promises");
const b = require('benny');

const db = new OldKeyValue({
	dataConfig: { path: "./__tests__/database" },
	encryptionConfig: {
		encriptData: false,
		securityKey: "a-32-characters-long-string-here",
	},
	fileConfig:{
		staticRehash:false,
		maxSize:20000
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

async function run() {
	let idx = 0;
	const setfn = async () => {
		const key = `key-${idx++}`;
		keys.push(key);
		await db.set("main", key, { value: Math.random() });

	}

	const getfn = async () =>
		await db.get("main", keys[Math.floor(Math.random() * keys.length)]);
	await b.suite(
		"KeyValue",
		b.add("set ", async () => {
			await setfn();
		}),
		b.add("get ", async () => {
			await getfn();
		}),
		b.add("has ", async () => {
			await db.has("main", keys[Math.floor(Math.random() * keys.length)]);
		}),
		b.cycle(),
		b.complete(),
		b.save({ file: 'KeyValue', version: '1.0.0' }),
		b.save({ file: 'KeyValue', format: 'chart.html' }),
	)

}