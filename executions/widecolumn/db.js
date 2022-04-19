const { WideColumn, Column } = require( "../../dist/cjs/index.js");

const prime = new Column({
  name: "id",
  primary: true,
  type: "number",
});
const xp = new Column({
  name: "xp",
  type: "number",
  primary: false,
  sortOrder: "DESC",
});

const db = new WideColumn({
  path: "./columndatabase/",
  encryptOption: {
    securitykey: "a-32-characters-long-string-here",
  },
  tables: [
    {
      name: "main",
      columns: [prime, xp],
    },
  ],
  storeOption: {
    maxDataPerFile: 10000,
  },
  cacheOption: {
    cacheReference: "MEMORY",
    limit: 10000,
  },
  methodOption:{
    getTime:20000,
    deleteTime:500,
  }
});
db.connect();
module.exports = db;