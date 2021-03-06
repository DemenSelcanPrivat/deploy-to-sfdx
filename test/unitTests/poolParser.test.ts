/* globals it, describe, before, after */
import * as fs from 'fs-extra';
import * as util from 'util';
import * as path from 'path';
import * as dotenv from 'dotenv';

import * as parser from '../../src/lib/poolParse';
import * as utilities from '../../src/lib/utilities';

const exec = util.promisify(require('child_process').exec);

const username = 'mshanemc';

dotenv.config();
const timeout = 500000;

describe('poolURLTest', () => {

	test.skip('gets an array of objects', async () => {

		if (process.env.POOLCONFIG_URL){

			// the pool is sane
			expect(process.env.POOLCONFIG_URL).toBeInstanceOf('string');

			const result = await utilities.getPoolConfig();

			expect(result).toBeInstanceOf('array');
			expect(result.length).toBeGreaterThan(0);
			expect(typeof result[0].repo).toBe('string');
			expect(typeof result[0].user).toBe('string');
			expect(typeof result[0].quantity).toBe('number');
			expect(typeof result[0].lifeHours).toBe('number');
			expect(result[0].quantity).toBeGreaterThan(0);
			expect(result[0].lifeHours).toBeGreaterThan(0);
		}
	}, timeout);

	test.skip('gets an object from the array', async () => {
		if (process.env.POOLCONFIG_URL) {

			// the pool is sane
			expect(process.env.POOLCONFIG_URL).toBeInstanceOf('string');

			const result = await utilities.getPoolConfig();

			const pool = await utilities.getPool(result[0].user, result[0].repo);


			expect(pool).toBeInstanceOf('object');
			expect(typeof result[0].repo).toBe('string');
			expect(typeof result[0].user).toBe('string');
			expect(pool.quantity).toBeInstanceOf('number');
			expect(pool.lifeHours).toBeInstanceOf('number');
			expect(pool.quantity).toBeGreaterThan(0);
			expect(pool.lifeHours).toBeGreaterThan(0);
		}
	}, timeout);
});

describe('tests the crash course workshop', () => {

	const repo = 'df17AppBuilding';
	const tmpDir = path.join(__dirname, '../../poolParsed');
	const filepath = path.join(tmpDir, repo, 'orgInit.sh');
	const cloneDirPath = path.join(tmpDir, repo);

	beforeAll(async () => {
		fs.ensureDirSync(tmpDir);
		await exec(`git clone https://github.com/${username}/${repo}`, { 'cwd': tmpDir });
	});

	test('works for a org:open only file', async () => {
		expect(fs.existsSync(filepath));
		const result = await parser(filepath);
		expect(result);
		expect(result.openLine).toBe('sfdx force:org:open');
	}, timeout);

	afterAll(async () => {
		await fs.remove(cloneDirPath);
		await fs.remove(tmpDir);
	});
});

describe('tests the trial', () => {

	const repo = 'platformTrial';
	const tmpDir = path.join(__dirname, '../../poolParserTestRepoTrial');
	const filepath = path.join(tmpDir, repo, 'orgInit.sh');
	const cloneDirPath = path.join(tmpDir, repo);

	beforeAll(async () => {
		fs.ensureDirSync(tmpDir);
		await exec(`git clone https://github.com/${username}/${repo}`, { 'cwd': tmpDir });
	}, timeout);

	test('works for a org:open with a path', async () => {
		expect(fs.existsSync(filepath));
		const result = await parser(filepath);
		expect(result);
		expect(result.openLine).toContain('sfdx force:org:open');
		expect(result.openLine).toContain('-p');
	}, timeout);

	afterAll(async () => {
		await fs.remove(cloneDirPath);
		await fs.remove(tmpDir);
	}, timeout);
});

describe('tests the integration workshop', () => {

	const repo = 'DF17integrationWorkshops';
	const tmpDir = path.join(__dirname, '../../poolPraseIntegration');
	const filepath = path.join(tmpDir, repo, 'orgInit.sh');
	const cloneDirPath = path.join(tmpDir, repo);

	beforeAll(async () => {
		fs.ensureDirSync(tmpDir);
		await exec(`git clone https://github.com/${username}/${repo}`, { 'cwd': tmpDir });
	});

	test('works with custom user password set', async () => {
		expect(fs.existsSync(filepath));
		const result = await parser(filepath);
		expect(result);
		expect(result.openLine).toContain('sfdx force:org:open');
		expect(result.passwordLine).toBe('sfdx shane:user:password:set -l User -g User -p sfdx1234 --json');
	}, timeout);

	afterAll(async () => {
		await fs.remove(cloneDirPath);
		await fs.remove(tmpDir);
	}, timeout);
});