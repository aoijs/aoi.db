const typeDocConfig = require('../typedoc.json');
const ZenethPkg = require('../package.json');
const fs = require('fs');

typeDocConfig.out = `./site/src/pages/docs/${ZenethPkg.version}`;

fs.writeFileSync('./typedoc.json', JSON.stringify(typeDocConfig, null, 4));
