"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const redis_connection_1 = require("./redis-connection");
class QueueBase extends events_1.EventEmitter {
    constructor(name, opts = {}) {
        super();
        this.name = name;
        this.opts = opts;
        this.opts = Object.assign({ prefix: 'bull' }, opts);
        this.connection = new redis_connection_1.RedisConnection(opts.connection);
        this.connection.on('error', this.emit.bind(this));
        const keys = {};
        [
            '',
            'active',
            'wait',
            'waiting',
            'paused',
            'resumed',
            'id',
            'delayed',
            'priority',
            'stalled-check',
            'completed',
            'failed',
            'stalled',
            'repeat',
            'limiter',
            'drained',
            'progress',
            'meta',
            'events',
            'delay',
        ].forEach(key => {
            keys[key] = this.toKey(key);
        });
        this.keys = keys;
    }
    toKey(type) {
        return `${this.opts.prefix}:${this.name}:${type}`;
    }
    get client() {
        return this.connection.client;
    }
    // TO BE DEPRECATED
    async waitUntilReady() {
        return this.client;
    }
    base64Name() {
        return Buffer.from(this.name).toString('base64');
    }
    clientName() {
        return this.opts.prefix + ':' + this.base64Name();
    }
    close() {
        if (!this.closing) {
            this.emit('closing');
            this.closing = this.connection.close().then(() => {
                this.emit('closed');
            });
        }
        return this.closing;
    }
    disconnect() {
        return this.connection.disconnect();
    }
}
exports.QueueBase = QueueBase;
//# sourceMappingURL=queue-base.js.map