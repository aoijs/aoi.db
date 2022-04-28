const { inspect } = require("util");
const {
  Transmitter,
  Receiver,
  TransmitterFlags,
} = require("./dist/cjs/index.js");

const rec = new Receiver({
  wsOptions: {
    port: 443,
    host: "localhost",
  },
  whitelistedIps: ["::1"],
  databaseType: "KeyValue",
  dbOptions: {
    path: "./Receiverdatabase/",
    tables: ["main"],
  },
});

rec.connect();
rec.on("connect", () => {
  console.log("connected");
});
rec.on("message", (msg) => {
  console.log(`[RECEIVER] => ${inspect(msg, { depth: null })}`);
});


const db = new Transmitter({
  path: "ws://localhost:443",
  flags: TransmitterFlags.READ_WRITE,
  tables: ["main"],
});

db.on("ready", () => {
  console.log("ready");
});
db.on("close", (code, reason) => {
  console.log("[TRANSMITTER] => " + code + " " + reason);
});
db.connect();
async function newset() {
  let i = 0;
  while (i < 20) {
    await db
      .set("main", "" + i, {
        value: i,
      })
      .then((d) => console.log({ d }))
      .catch((e) => console.error({ e }));
    i++;
  }
}
db.on("message", (msg) => {
  console.log(`[TRANSMITTER] => ${inspect(msg, { depth: null })}`);
});
setTimeout(async () => {
  await db
    .set("main", "hello", {
      value: "world",
    })
    //  .then((d) => console.log({ d }))
    .catch((e) => console.error({ e }));

  await db
    .get("main", "key")
    // .then((d) => console.log({ d }))
    .catch((e) => console.error({ e }));

  await db
    .all("main", { limit: 10 })
    // .then((d) => console.log({ d }))
    .catch((e) => console.error({ e }));
  console.log({ ping: db.ping });
}, 2000);
