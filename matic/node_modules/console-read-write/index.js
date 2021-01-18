const readline = require('readline');
const AwaitLock = require('await-lock');

const promptDefault = '> ';

const createReadlineInterface = (prompt = promptDefault) => readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt
});

let onSIGINT = (rl = createReadlineInterface()) => {
  console.log();
  rl.close();
  process.exit(0);
};

const setOnSIGINT = (callback = onSIGINT) => {
  onSIGINT = callback;
};

const readlineLock = new AwaitLock();
const acquireReadlineInterface = async (prompt = promptDefault) => {
  await readlineLock.acquireAsync();
  const rl = createReadlineInterface(prompt);
  rl.on('SIGINT', () => onSIGINT(rl));
  rl.on('close', () => readlineLock.release());
  return rl;
};

const write = line => console.log(line);

const read = async ({prompt = promptDefault} = {}) => {
  const rl = await acquireReadlineInterface(prompt);
  rl.prompt();
  const line = await new Promise(resolve => rl.on('line', resolve));
  rl.close();
  return line;
};

const ask = async (question, {delimiter = ' '} = {}) => {
  const rl = await acquireReadlineInterface();
  const answer = await new Promise(resolve => rl.question(question + delimiter, resolve));
  rl.close();
  return answer;
};

const io = {write, read, ask, setOnSIGINT, acquireReadlineInterface};

module.exports = Object.assign(io, {default: io});
