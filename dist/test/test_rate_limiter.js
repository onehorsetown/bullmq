"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const classes_1 = require("@src/classes");
const queue_events_1 = require("@src/classes/queue-events");
const queue_scheduler_1 = require("@src/classes/queue-scheduler");
const worker_1 = require("@src/classes/worker");
const chai_1 = require("chai");
const IORedis = require("ioredis");
const lodash_1 = require("lodash");
const mocha_1 = require("mocha");
const uuid_1 = require("uuid");
const utils_1 = require("@src/utils");
mocha_1.describe('Rate Limiter', function () {
    let queue;
    let queueName;
    let queueEvents;
    mocha_1.beforeEach(async function () {
        queueName = 'test-' + uuid_1.v4();
        queue = new classes_1.Queue(queueName);
        queueEvents = new queue_events_1.QueueEvents(queueName);
        await queueEvents.waitUntilReady();
    });
    afterEach(async function () {
        await queue.close();
        await queueEvents.close();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
    mocha_1.it('should put a job into the delayed queue when limit is hit', async () => {
        const worker = new worker_1.Worker(queueName, async (job) => { }, {
            limiter: {
                max: 1,
                duration: 1000,
            },
        });
        await worker.waitUntilReady();
        queueEvents.on('failed', err => {
            chai_1.assert.fail(err);
        });
        await Promise.all([
            queue.add('test', {}),
            queue.add('test', {}),
            queue.add('test', {}),
            queue.add('test', {}),
        ]);
        await Promise.all([
            worker.getNextJob('test-token'),
            worker.getNextJob('test-token'),
            worker.getNextJob('test-token'),
            worker.getNextJob('test-token'),
        ]);
        const delayedCount = await queue.getDelayedCount();
        chai_1.expect(delayedCount).to.eq(3);
    });
    mocha_1.it('should obey the rate limit', async function () {
        this.timeout(20000);
        const numJobs = 4;
        const startTime = new Date().getTime();
        const queueScheduler = new queue_scheduler_1.QueueScheduler(queueName);
        await queueScheduler.waitUntilReady();
        const worker = new worker_1.Worker(queueName, async (job) => { }, {
            limiter: {
                max: 1,
                duration: 1000,
            },
        });
        const result = new Promise((resolve, reject) => {
            queueEvents.on('completed', 
            // after every job has been completed
            lodash_1.after(numJobs, async () => {
                await worker.close();
                try {
                    const timeDiff = new Date().getTime() - startTime;
                    chai_1.expect(timeDiff).to.be.above((numJobs - 1) * 1000);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            }));
            queueEvents.on('failed', async (err) => {
                await worker.close();
                reject(err);
            });
        });
        for (let i = 0; i < numJobs; i++) {
            await queue.add('rate test', {});
        }
        await result;
        await worker.close();
        await queueScheduler.close();
    });
});
//# sourceMappingURL=test_rate_limiter.js.map