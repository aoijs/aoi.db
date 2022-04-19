const db = require("./db.js");

async function newall() {
  await db.all("main", "xp",undefined, Infinity);
}

module.exports = newall;
