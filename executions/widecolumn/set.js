const { Suite } = require("benchmark");
const newDB = require("./db.js");

async function newset() {
  let i = 100000;
  while (i --> 0) {
    await newDB.set("main", {
      name:"xp",
      value:i
    },{
      name:"id",
      value:i
    })
  }
}
module.exports = newset;
