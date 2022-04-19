const db = require("./db.js");

async function newdelete() {
  let i = 1000;
  if (db.options.cacheOption.cacheReference === "MEMORY") {
    while (i-- > 0) {
      await db.delete("main", "xp",i);
    }
  } else db.clear("submain");
}
module.exports = newdelete;
