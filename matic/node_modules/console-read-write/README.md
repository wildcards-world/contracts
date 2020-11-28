[![npm version](https://badge.fury.io/js/console-read-write.svg)](https://www.npmjs.com/package/console-read-write)
[![Build Status](https://api.travis-ci.org/assister-ai/console-read-write.svg?branch=master)](https://travis-ci.org/assister-ai/console-read-write)

# console-read-write
Read from and write to the Node.js console. A simple `async/await` interface for the [`readline`](https://nodejs.org/api/readline.htm) module

## Install
```sh
npm i --save console-read-write
```

## Usage

```js
const io = require('console-read-write');

async function main() {
  // Simple readline scenario
  io.write('I will echo whatever you write!');
  io.write(await io.read());

  // Simple question scenario
  io.write(`hello ${await io.ask('Who are you?')}!`);

  // Since you are not blocking the IO, you can go wild with while loops!
  let saidHi = false;
  while (!saidHi) {
    io.write('Say hi or I will repeat...');
    saidHi = await io.read() === 'hi';
  }

  io.write('Thanks! Now you may leave.');
}

main();
// I will echo whatever you write!
// > ok
// ok
// Who are you? someone
// hello someone!
// Say hi or I will repeat...
// > no
// Say hi or I will repeat...
// > ok
// Say hi or I will repeat...
// > hi
// Thanks! Now you may leave.
```

# Licence
[MIT](https://github.com/assister-ai/console-read-write/blob/master/LICENSE)
