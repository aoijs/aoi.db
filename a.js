const fsp = require('fs').promises;

// write 10k lines

(async () => {
	  for (let i = 0; i < 10000; i++) {
	await fsp.appendFile('b.txt', 'a\n',{
		flush: true
	});
  }
})().then(() => {

(async () => {
	const file = await fsp.open('b.txt', 'r+');

	for await(const line of file.readLines({
		'autoClose': false,
		emitClose: false,
	})) {
		console.log(line);
	}

	console.log(await file.read({
		offset: 0,
		length: 10,
	}));
})()

});