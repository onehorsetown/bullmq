"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const IORedis = require("ioredis");
const lodash_1 = require("lodash");
const classes_1 = require("@src/classes");
const mocha_1 = require("mocha");
const uuid_1 = require("uuid");
const utils_1 = require("@src/utils");
const pReflect = require('p-reflect');
describe('sandboxed process', () => {
    let queue;
    let queueEvents;
    let queueName;
    mocha_1.beforeEach(async function () {
        queueName = 'test-' + uuid_1.v4();
        queue = new classes_1.Queue(queueName);
        queueEvents = new classes_1.QueueEvents(queueName);
        await queueEvents.waitUntilReady();
    });
    afterEach(async () => {
        await queue.close();
        await queueEvents.close();
        classes_1.pool.clean();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
    it('should process and complete', async () => {
        const processFile = __dirname + '/fixtures/fixture_processor.js';
        const worker = new classes_1.Worker(queueName, processFile, {
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const completting = new Promise((resolve, reject) => {
            worker.on('completed', async (job, value) => {
                try {
                    chai_1.expect(job.data).to.be.eql({ foo: 'bar' });
                    chai_1.expect(value).to.be.eql(42);
                    chai_1.expect(Object.keys(worker['childPool'].retained)).to.have.lengthOf(0);
                    chai_1.expect(worker['childPool'].free[processFile]).to.have.lengthOf(1);
                    await worker.close();
                    resolve();
                }
                catch (err) {
                    await worker.close();
                    reject(err);
                }
            });
        });
        await queue.add('test', { foo: 'bar' });
        await completting;
        await worker.close();
    });
    it('should process with named processor', async () => {
        const processFile = __dirname + '/fixtures/fixture_processor.js';
        const worker = new classes_1.Worker(queueName, processFile, {
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const completting = new Promise((resolve, reject) => {
            worker.on('completed', async (job, value) => {
                try {
                    chai_1.expect(job.data).to.be.eql({ foo: 'bar' });
                    chai_1.expect(value).to.be.eql(42);
                    chai_1.expect(Object.keys(worker['childPool'].retained)).to.have.lengthOf(0);
                    chai_1.expect(worker['childPool'].free[processFile]).to.have.lengthOf(1);
                    await worker.close();
                    resolve();
                }
                catch (err) {
                    await worker.close();
                    reject(err);
                }
            });
        });
        await queue.add('foobar', { foo: 'bar' });
        await completting;
    });
    it('should process with concurrent processors', async function () {
        this.timeout(10000);
        let worker;
        await Promise.all([
            queue.add('test', { foo: 'bar1' }),
            queue.add('test', { foo: 'bar2' }),
            queue.add('test', { foo: 'bar3' }),
            queue.add('test', { foo: 'bar4' }),
        ]);
        const processFile = __dirname + '/fixtures/fixture_processor_slow.js';
        worker = new classes_1.Worker(queueName, processFile, {
            concurrency: 4,
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const completing = new Promise((resolve, reject) => {
            const after4 = lodash_1.after(4, () => {
                chai_1.expect(worker['childPool'].getAllFree().length).to.eql(4);
                resolve();
            });
            worker.on('completed', async (job, value) => {
                try {
                    chai_1.expect(value).to.be.eql(42);
                    chai_1.expect(Object.keys(worker['childPool'].retained).length +
                        worker['childPool'].getAllFree().length).to.eql(4);
                    after4();
                }
                catch (err) {
                    await worker.close();
                    reject(err);
                }
            });
        });
        await completing;
        await worker.close();
    });
    it('should reuse process with single processors', async function () {
        this.timeout(30000);
        let worker;
        const processFile = __dirname + '/fixtures/fixture_processor_slow.js';
        worker = new classes_1.Worker(queueName, processFile, {
            concurrency: 1,
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        await Promise.all([
            queue.add('1', { foo: 'bar1' }),
            queue.add('2', { foo: 'bar2' }),
            queue.add('3', { foo: 'bar3' }),
            queue.add('4', { foo: 'bar4' }),
        ]);
        const completting = new Promise((resolve, reject) => {
            const after4 = lodash_1.after(4, async () => {
                chai_1.expect(worker['childPool'].getAllFree().length).to.eql(1);
                await worker.close();
                resolve();
            });
            worker.on('completed', async (job, value) => {
                try {
                    chai_1.expect(value).to.be.eql(42);
                    chai_1.expect(Object.keys(worker['childPool'].retained).length +
                        worker['childPool'].getAllFree().length).to.eql(1);
                    await after4();
                }
                catch (err) {
                    await worker.close();
                    reject(err);
                }
            });
        });
        await completting;
    });
    it('should process and update progress', async () => {
        const processFile = __dirname + '/fixtures/fixture_processor_progress.js';
        const worker = new classes_1.Worker(queueName, processFile, {
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const progresses = [];
        const completing = new Promise((resolve, reject) => {
            worker.on('completed', async (job, value) => {
                try {
                    chai_1.expect(job.data).to.be.eql({ foo: 'bar' });
                    chai_1.expect(value).to.be.eql(37);
                    chai_1.expect(job.progress).to.be.eql(100);
                    chai_1.expect(progresses).to.be.eql([10, 27, 78, 100]);
                    chai_1.expect(Object.keys(worker['childPool'].retained)).to.have.lengthOf(0);
                    chai_1.expect(worker['childPool'].getAllFree()).to.have.lengthOf(1);
                    const logs = await queue.getJobLogs(job.id);
                    chai_1.expect(logs).to.be.eql({
                        logs: ['10', '27', '78', '100'],
                        count: 4,
                    });
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        worker.on('progress', (job, progress) => {
            progresses.push(progress);
        });
        await queue.add('test', { foo: 'bar' });
        await completing;
        await worker.close();
    });
    it('should process and fail', async () => {
        const processFile = __dirname + '/fixtures/fixture_processor_fail.js';
        const worker = new classes_1.Worker(queueName, processFile, {
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const failing = new Promise((resolve, reject) => {
            worker.on('failed', async (job, err) => {
                try {
                    chai_1.expect(job.data).eql({ foo: 'bar' });
                    chai_1.expect(job.failedReason).eql('Manually failed processor');
                    chai_1.expect(err.message).eql('Manually failed processor');
                    chai_1.expect(err.stack).include('fixture_processor_fail.js');
                    chai_1.expect(Object.keys(worker['childPool'].retained)).to.have.lengthOf(0);
                    chai_1.expect(worker['childPool'].getAllFree()).to.have.lengthOf(1);
                    resolve();
                }
                catch (err) {
                    await worker.close();
                    reject(err);
                }
            });
        });
        await queue.add('test', { foo: 'bar' });
        await failing;
        await worker.close();
    });
    it('should error if processor file is missing', async () => {
        let worker;
        let didThrow = false;
        try {
            const missingProcessFile = __dirname + '/fixtures/missing_processor.js';
            worker = new classes_1.Worker(queueName, missingProcessFile, {});
        }
        catch (err) {
            didThrow = true;
        }
        worker && (await worker.close());
        if (!didThrow) {
            throw new Error('did not throw error');
        }
    });
    it('should fail if the process crashes', async () => {
        const processFile = __dirname + '/fixtures/fixture_processor_crash.js';
        const worker = new classes_1.Worker(queueName, processFile, {
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const job = await queue.add('test', {});
        const inspection = await pReflect(Promise.resolve(job.waitUntilFinished(queueEvents)));
        chai_1.expect(inspection.isRejected).to.be.eql(true);
        chai_1.expect(inspection.reason.message).to.be.eql('boom!');
    });
    it('should fail if the process exits 0', async () => {
        const processFile = __dirname + '/fixtures/fixture_processor_crash.js';
        new classes_1.Worker(queueName, processFile, {
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const job = await queue.add('test', { exitCode: 0 });
        const inspection = await pReflect(Promise.resolve(job.waitUntilFinished(queueEvents)));
        chai_1.expect(inspection.isRejected).to.be.eql(true);
        chai_1.expect(inspection.reason.message).to.be.eql('Unexpected exit code: 0 signal: null');
    });
    it('should fail if the process exits non-0', async () => {
        const processFile = __dirname + '/fixtures/fixture_processor_crash.js';
        new classes_1.Worker(queueName, processFile, {
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const job = await queue.add('test', { exitCode: 1 });
        const inspection = await pReflect(Promise.resolve(job.waitUntilFinished(queueEvents)));
        chai_1.expect(inspection.isRejected).to.be.eql(true);
        chai_1.expect(inspection.reason.message).to.be.eql('Unexpected exit code: 1 signal: null');
    });
    it('should remove exited process', async () => {
        const processFile = __dirname + '/fixtures/fixture_processor_exit.js';
        const worker = new classes_1.Worker(queueName, processFile, {
            drainDelay: 1,
            settings: {
                guardInterval: 300000,
                stalledInterval: 300000,
            },
        });
        const completting = new Promise((resolve, reject) => {
            worker.on('completed', async () => {
                try {
                    chai_1.expect(Object.keys(worker['childPool'].retained)).to.have.lengthOf(0);
                    chai_1.expect(worker['childPool'].getAllFree()).to.have.lengthOf(1);
                    await utils_1.delay(500);
                    chai_1.expect(Object.keys(worker['childPool'].retained)).to.have.lengthOf(0);
                    chai_1.expect(worker['childPool'].getAllFree()).to.have.lengthOf(0);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        await queue.add('test', { foo: 'bar' });
        await completting;
        await worker.close();
    });
});
//# sourceMappingURL=test_sandboxed_process.js.map