const db = require("./db.js");

async function newall() {
  await db.all("submain", undefined, Infinity);
}

module.exports = newall;
