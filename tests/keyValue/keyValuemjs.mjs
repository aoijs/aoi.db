import { KeyValue } from "../../dist/esm/index.js";
const db = new KeyValue({
  path: "./__tests_dbs__/database/", //path of the database
  tables: ["main"], // TableName[]
  methodOption: {
    saveTime: 100, // queue time to flush data into file
    deleteTime: 500, // queue time to delete data from file
  },
  encryptOption: {
    securitykey: "a-32-characters-long-string-here", //32 bit long securityKey for encrypting (this is 32 characters long too ;) )
    enabled: true, //enabling encryption
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
    {
      key: "string",
      options: {
        value: "hello",
      },
    },
    {
      key: "bigint",
      options: {
        value: BigInt("1"),
      },
    },
    {
      key: "boolean",
      options: {
        value: true,
      },
    },
    {
      key: "date",
      options: {
        value: new Date(),
      },
    },
    {
      key: "object",
      options: {
        value: {
          hello: "world",
        },
      },
    },
  );

  await db.get("main", "string").then((d) => console.log({ getData: d }));
  await db.delete("main", "string");
  await db.all("main").then(console.table);
  console.log(`avg Ping: ${db.ping} ms`);
  console.log(`table main ping is: ${db.tablePing("main")} ms`);

  db.clear("main");
}

await run().then((_) => console.log("executed esm test for KeyValue"));
