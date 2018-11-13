"use strict";
// import * as logger from 'heroku-logger';
const logger = require("heroku-logger");
const argStripper = function (cmd, parameter, noarg) {
    // add a space to the end to simplify things
    cmd = cmd.concat(' ');
    // quickly return if it doesn't exist
    const bufferedParam = ' '.concat(parameter).concat(' ');
    if (!cmd.includes(bufferedParam)) {
        logger.debug('param not in command');
        return cmd.trim();
    }
    else {
        let output = cmd;
        if (noarg) {
            // just remove the thing!
            output = cmd.replace(' '.concat(parameter).concat(' '), ' ');
        }
        else {
            // find the string
            const paramStartIndex = cmd.indexOf(' '.concat(parameter).concat(' ')) + 1;
            // console.log(`param starts at ${paramStartIndex}`);
            const paramEndIndex = paramStartIndex + parameter.length - 1; // because there'll be a space, and because origin
            // console.log(`param ends at ${paramEndIndex}`);
            const paramValueStart = paramEndIndex + 2;
            // console.log(`value starts at ${paramValueStart}`);
            let paramValueEnd;
            // if it starts with a ` or ' or " we need to find the other end.  Otherwise, it's a space
            if (cmd.charAt(paramValueStart) === '"' || cmd.charAt(paramValueStart) === '\'' || cmd.charAt(paramValueStart) === '`') {
                logger.debug(`it is a quoted string starting with ${cmd.charAt(paramValueStart)}`);
                const quoteEnd = cmd.indexOf(cmd.charAt(paramValueStart), paramValueStart + 1);
                if (cmd.charAt(quoteEnd + 1) === ' ') {
                    paramValueEnd = quoteEnd;
                }
                else {
                    paramValueEnd = cmd.indexOf(' ', quoteEnd + 1) - 1;
                }
            }
            else {
                // normal type with a space
                paramValueEnd = cmd.indexOf(' ', paramValueStart) - 1;
            }
            // console.log(`value ends at ${paramValueEnd}`);
            output = cmd.slice(0, paramStartIndex - 1).concat(' ').concat(cmd.slice(paramValueEnd + 2));
        }
        logger.debug(`converted ${cmd} to ${output}`);
        return output.trim();
    }
};
module.exports = argStripper;
