const { setTimeout } = require("timers/promises");
const newall = require("./all.js");
const colors = require("./colors.js");
const db = require("./db.js");
const newdelete = require("./delete.js");
const newget = require("./get.js");
const newset = require("./set.js");
async function exec() {
  
  let sets = 0;
  let setHigh = 0;
  let setlowest = 10000;

  let gets = 0;
  let getHigh = 0;
  let getlowest = 10000;

  let alls = 0;
  let allHigh = 0;
  let alllowest = 10000;

  let deletes = 0;
  let deleteHigh = 0;
  let deletelowest = 10000;

  let i = 5;

  const debugs = {};

  async function run() {
    let start = performance.now();
    await newset();
    let end = Number((performance.now() - start).toFixed(3));
    sets += end;
    if (end > setHigh) {
      setHigh = end;
    }
    if (end < setlowest) {
      setlowest = end;
    }

    console.log(
      `${colors.FgBlue}newset() -> ${colors.Bright}${colors.FgBlue}executed${colors.Reset};       ${colors.FgBlue}DB#set() -> ${colors.Bright}${colors.FgBlue}called 100k times${colors.Reset};      ${colors.FgBlue}time: ${colors.Bright}${colors.FgCyan}${end}ms${colors.Reset}`,
    );

    await setTimeout(2000);

    start = performance.now();
    await newget();
    end = Number((performance.now() - start).toFixed(3));
    gets += end;
    if (end > getHigh) {
      getHigh = end;
    }
    if (end < getlowest) {
      getlowest = end;
    }

    console.log(
      `${colors.FgBlue}newget() -> ${colors.Bright}${colors.FgBlue}executed${colors.Reset};       ${colors.FgBlue}DB#get() -> ${colors.Bright}${colors.FgBlue}called 100k times${colors.Reset};      ${colors.FgBlue}time: ${colors.Bright}${colors.FgCyan}${end}ms${colors.Reset}`,
    );

    await setTimeout(2000);

    start = performance.now();
    await newall();
    end = Number((performance.now() - start).toFixed(3));
    alls += end;
    if (end > allHigh) {
      allHigh = end;
    }
    if (end < alllowest) {
      alllowest = end;
    }

    console.log(
      `${colors.FgBlue}newall() -> ${colors.Bright}${colors.FgBlue}executed${colors.Reset};       ${colors.FgBlue}DB#all() -> ${colors.Bright}${colors.FgBlue}called 1 time${colors.Reset};         ${colors.FgBlue}time: ${colors.Bright}${colors.FgCyan}${end}ms${colors.Reset}`,
    );

    await setTimeout(2000);

    start = performance.now();
    await newdelete();
    end = Number((performance.now() - start).toFixed(3));
    deletes += end;
    if (end > deleteHigh) {
      deleteHigh = end;
    }
    if (end < deletelowest) {
      deletelowest = end;
    }

    console.log(
      `${colors.FgBlue}newdelete() -> ${colors.Bright}${colors.FgBlue}executed${colors.Reset};    ${colors.FgBlue}DB#delete() -> ${colors.Bright}${colors.FgBlue}called 100k times${colors.Reset};   ${colors.FgBlue}time: ${colors.Bright}${colors.FgCyan}${end}ms${colors.Reset}`,
    );

    await setTimeout(2000);
  }
  while (i-- > 0) {
    console.log(
      colors.Reset +
        colors.Bright +
        colors.FgMagenta +
        "-------------------Roll #" +
        (5 - i) +
        "-------------------" +
        colors.Reset,
    );
    await run();
  }

  debugs.set = {
    average: `${(sets / 5).toFixed(3)} ms`,
    high: `${setHigh} ms`,
    lowest: `${setlowest} ms`,
  };

  debugs.get = {
    average: `${(gets / 5).toFixed(3)} ms`,
    high: `${getHigh} ms`,
    lowest: `${getlowest} ms`,
  };

  debugs.all = {
    average: `${(alls / 5).toFixed(3)} ms`,
    high: `${allHigh} ms`,
    lowest: `${alllowest} ms`,
  };

  debugs.delete = {
    average: `${(deletes / 5).toFixed(3)} ms`,
    high: `${deleteHigh} ms`,
    lowest: `${deletelowest} ms`,
  };

  console.table({
    "DB#set": { calls: 500000 },
    "DB#get": { calls: 500000 },
    "DB#all": { calls: 5 },
    "DB#delete": { calls: 500000 },
  });

  console.table(debugs);
}
exec().then((_) => {
  newset();
});