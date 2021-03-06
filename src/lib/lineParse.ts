import * as fs from 'fs';
import * as logger from 'heroku-logger';
import * as readline from 'readline';

import * as shellSanitize from './shellSanitize';
import * as argStripper from './argStripper';
import { deployRequest } from './types';

const lineParse = function(msgJSON: deployRequest): Promise<string[]> {
  logger.debug('lineParse: started');

  return new Promise((resolve, reject) => {
    const parsedLines = [];

    const rl = readline
      .createInterface({
        input: fs.createReadStream(`tmp/${msgJSON.deployId}/orgInit.sh`),
        terminal: false
      })
      .on('line', (line: string) => {
        line = line.trim();
        if (line && line.length> 0 && !line.startsWith('#!/bin/bash') && !line.startsWith('#')){
          logger.debug(`lineParse: Line: ${line}`);
          if (msgJSON.whitelisted) {
            // if the user or repo is on the whitelist, we'll let you execute whatever you like, except empty lines!
            parsedLines.push(jsonify(line));
          } else if (!shellSanitize(line)) {
            // otherwise, we're goign to inspect your code very carefully
            const errorMessage = `ERROR: Commands with metacharacters cannot be executed.  Put each command on a separate line.  Your command: ${line}`;
            logger.error(errorMessage, msgJSON);
            reject(errorMessage);
          } else if (line.includes('-u ')) {
            logger.debug('lineParse: found a -u in a command line');
            const errorMessage = `ERROR: Commands can't contain -u...you can only execute commands against the default project the deployer creates--this is a multitenant sfdx deployer.  Your command: ${line}`;
            logger.error(errorMessage, msgJSON);
            reject(errorMessage);
          } else if (!line.startsWith('sfdx') && !line.startsWith('#')) {
            const errorMessage = `ERROR: Commands must start with sfdx or be comments (security, yo!).  Your command: ${line}`;
            logger.error(errorMessage, msgJSON);
            reject(errorMessage);
          } else {
            // it's an OK line.
            logger.debug('lineParse: line pushed');

            // json-ify every line
            line = `${argStripper(line, '--json', true)} --json`;
            parsedLines.push(jsonify(line));
          }
        }
      })
      .on('close', () => {
        // you have all the parsed lines
        logger.debug('lineParse: closed with lines', parsedLines);
        resolve(parsedLines.filter( line => line !== ''));
      });
  });
};

const jsonify = (line: string): string => {
  if ( line.startsWith('sfdx ') ) {
    // TODO: handling for & at the end of line for background runs
    return `${argStripper(line, '--json', true)} --json`;
  } else {
    return line;
  }
};

export { lineParse, jsonify };
