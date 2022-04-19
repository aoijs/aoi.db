const db = require("./db.js");

async function newget() {
  let i = 100000;

  while (i-- > 0) {
    await db.get("submain", "" + i);
  }
}

module.exports = newget;
