const { Suite } = require("benchmark");
const newDB = require("./db.js");

async function newset() {
  let i = 100000;
  console.time("newset");
  while (i --> 0) {
    await newDB.set("submain", "" + i, {
      value: BigInt(`${i}`),
    });
  }
  console.timeEnd("newset");
}
module.exports = newset;
