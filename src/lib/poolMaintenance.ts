import * as logger from 'heroku-logger';
import * as util from 'util';

import * as utilities from './utilities';
import * as redis from './redisNormal';

import { poolRequest } from './types';

const exec = util.promisify(require('child_process').exec);

utilities.checkHerokuAPI();

// one-off dynos to flush anything in the queue already
const existingQFlush = async () => {
	const currentNeed = await redis.llen('poolDeploys');
	if (currentNeed > 0) {
		logger.debug(`going to start ${currentNeed} dynos to handle existing poolDeploys`);
		const execs = [];
		for (let x = 0; x < currentNeed; x++) {
			execs.push(exec(`heroku run:detached pooldeployer -a ${process.env.HEROKU_APP_NAME}`));
		}
		await Promise.all(execs);
	} else {
		logger.debug('no additional builders needed for poolQueue');
	}
};


const preparePoolByName = async (pool) => {

	const targetQuantity = pool.quantity;
	const poolname = `${pool.user}.${pool.repo}`;

	const actualQuantity = await redis.llen(poolname);

	const messages = [];
	const execs = [];

	if (actualQuantity < targetQuantity) {
		const needed = (targetQuantity - actualQuantity);
		logger.debug(`pool ${poolname} has ${actualQuantity} ready out of ${targetQuantity}...`);

		for (let x = 0; x < needed; x++) {
			const username = poolname.split('.')[0];
			const repo = poolname.split('.')[1];
			const deployId = encodeURIComponent(`${username}-${repo}-${new Date().valueOf()}`);

			const message: poolRequest = {
				pool: true,
				username,
				repo,
				deployId,
				whitelisted: true,

			};

			// branch support
			if (poolname.split('.')[2]) {
				message.branch = poolname.split('.')[2];
			}

			// await redis.rpush('poolDeploys', JSON.stringify(message));
			// await exec(`heroku run:detached pooldeployer -a ${process.env.HEROKU_APP_NAME}`);
			messages.push(redis.rpush('poolDeploys', JSON.stringify(message)));
			execs.push(exec(`heroku run:detached pooldeployer -a ${process.env.HEROKU_APP_NAME}`));

		}

		await Promise.all(messages);
		await Promise.all(execs);
		logger.debug(`...Requesting ${needed} more org for ${poolname}...`);
	} else {
		logger.debug(`pool ${poolname} has ${actualQuantity} ready out of ${targetQuantity} and is full.`);
	}

};



const prepareAll = async () => {
	const pools = await utilities.getPoolConfig();
	logger.debug(`preparing ${pools.length} pools`);

	const prepares = [];
	pools.forEach( (pool) => {
		prepares.push(preparePoolByName(pool));
	});

	await Promise.all(prepares);
	logger.debug('all pools prepared');
};

existingQFlush()
.then( async () => {
	await prepareAll();
	process.exit(0);
});
