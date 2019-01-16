import * as logger from 'heroku-logger';
import * as moment from 'moment';
import * as request from 'request-promise-native';
import * as util from 'util';
import { redis } from './redisNormal';

import * as utilities from './utilities';
import { poolOrg, poolConfig } from './types';

// const utilities = require('./utilities');
const exec = util.promisify(require('child_process').exec);

const checkExpiration = async (pool: poolConfig): Promise<string> => {
  const poolname = `${pool.user}.${pool.repo}`;
  const poolOrg = await redis.lpop(poolname);

  if (!poolOrg) {
    return `pool ${poolname} is empty`;
  }

  const msgJSON = <poolOrg>JSON.parse(poolOrg);
  if (
    moment().diff(moment(msgJSON.createdDate)) >
    pool.lifeHours * 60 * 60 * 1000
  ) {
    // it's gone if we don't put it back

    // create the delete message
    if (msgJSON.displayResults && msgJSON.displayResults.username) {
      await redis.rpush(
        'poolDeploys',
        JSON.stringify({
          username: msgJSON.displayResults.username,
          delete: true
        })
      );
    } else {
      logger.warn('pool org did not have a username', msgJSON);
    }
    await exec(
      `heroku run:detached pooldeployer -a ${process.env.HEROKU_APP_NAME}`
    );
    return `removed an expired org from pool ${poolname}`;
  } else {
    await redis.lpush(poolname, JSON.stringify(msgJSON));
    return `all the orgs in pool ${poolname} are fine`;
  }
};

const skimmer = async () => {
  const pools = await utilities.getPoolConfig();
  const promises = [];

  pools.forEach((pool) => {
    promises.push(checkExpiration(pool));
  });

  const results = await Promise.all(promises);
  results.forEach(result => logger.debug(result));
};

const herokuExpirationCheck = async () => {
  const herokuDeletes = await redis.lrange('herokuDeletes', 0, -1);
  await redis.del('herokuDeletes');

  if (herokuDeletes.length > 0) {
    if (!process.env.HEROKU_API_KEY) {
      logger.warn('there is no heroku API key');
    } else {
      const execs = [];

      const headers = {
        Accept: 'application/vnd.heroku+json; version=3',
        Authorization: `Bearer ${process.env.HEROKU_API_KEY}`
      };

      herokuDeletes.forEach((raw) => {
        const herokuDelete = JSON.parse(raw);
        if (moment(herokuDelete.expiration).isBefore(moment())) {
          logger.debug(`deleting heroku app: ${herokuDelete.appName}`);
          execs.push(
            request.delete({
              url: `https://api.heroku.com/apps/${herokuDelete.appName}`,
              headers,
              json: true
            })
          );
        } else {
          execs.push(
            redis.rpush('herokuDeletes', JSON.stringify(herokuDelete))
          );
        }
      });

      const results = await Promise.all(execs);
      results.forEach(result => logger.debug(result));
    }
  }
};

(async () => {
  try {
    if (utilities.checkHerokuAPI()){
      await Promise.all([skimmer(), herokuExpirationCheck()]);
    }
  } catch (err){
    logger.error(err);
  }
})();
