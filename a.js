const Receiver = require("./dist/cjs/ws/receiver/database.js").Receiver;
const db = new Receiver({
  path: "./Recieveratabase/",
  tables: ["main"],
  databaseType: "KeyValue",
  wsOptions: {
    port: 8080,
  },
  whitelistedIps: "*",
});

db.connect();