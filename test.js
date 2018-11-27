const shell = require('shelljs');

shell.config.silent = true;

test('TEST FAILURE: Build not found -p', () => expect(shell.exec('node ./script/s3.js -p ../sakjdh/./..asd').stderr).toContain('Error: ENOENT: no such file or directory'));

test('TEST FAILURE: Build not found --path', () => expect(shell.exec('node ./script/s3.js --path ../sakjdh/./..asd').stderr).toContain('Error: ENOENT: no such file or directory'));

test('TEST FAILURE: Env not found -e', () => expect(shell.exec('node ./script/s3.js -e sakjdh').stderr).toContain('There are no credentials for environment:'));

test('TEST FAILURE: Env not found --env', () => expect(shell.exec('node ./script/s3.js --env sakjdh').stderr).toContain('There are no credentials for environment:'));
