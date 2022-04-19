const { WideColumn,Column } = require("../../dist/cjs/index.js");
const xp = new Column({
  name: "xp",
  type: "number",
  primary: false,
  sortOrder: "DESC",
});

const level = new Column({
  name: "level",
  type: "number",
  primary: false,
  sortOrder: "DESC",
});
const prime = new Column({
  name: "id",
  type: "string",
  primary: true,
});

const db = new WideColumn({
  path: "./columndatabase/",
  encryptOption: {
    securitykey: "a-32-characters-long-string-here",
  },
  tables: [
    {
      name: "main",
      columns: [prime, xp, level],
    },
  ],
  storeOption: {
    maxDataPerFile: 5000,
  },
  cacheOption: {
    cacheReference: "MEMORY",
    limit: 5000,
  },
});

db.on("ready", () => {
  console.log(`Database is Ready`);
});

db.on("debug", console.log);

db.connect();
async function run() {
  await db.bulkSet(
    "main",
    [
      {
        name: "xp",
        value: 2,
      },
      {
        name: "id",
        value: "2",
      },
    ],
    [
      {
        name: "xp",
        value: 1,
      },
      {
        name: "id",
        value: "1",
      },
    ],
    [
      {
        name: "xp",
        value: 3,
      },
      {
        name: "id",
        value: "3",
      },
    ],
    [
      {
        name: "level",
        value: 1,
      },
      {
        name: "id",
        value: "1",
      },
    ],
  );

  await db.get("main", "xp","1").then((d) => console.log({ getData: d }));
  await db
    .delete("main", "xp","1")
    .then(console.log("deleted key 1 from xp column"));
  await db.all("main","xp").then(console.log);
  await db.allData("main").then(console.table);
  console.log(`avg Ping: ${db.ping} ms`);
  console.log(`table main ping is: ${db.tablePing("main")} ms`);
  db.getTransactionLog("main","xp").then(console.table);
  db.clear("main");
}

run().then((_) => console.log("executed cjs test for WideColumn"));
