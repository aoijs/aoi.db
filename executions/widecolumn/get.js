const db = require("./db.js");

async function newget() {
  let i = 1000;

  while (i-- > 0) {
    await db.get("main", "xp",i);
  }
}

module.exports = newget;
