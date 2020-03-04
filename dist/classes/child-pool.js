"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path = require("path");
const lodash_1 = require("lodash");
const getPort = require("get-port");
const fs = require("fs");
const util_1 = require("util");
const stat = util_1.promisify(fs.stat);
const convertExecArgv = async (execArgv) => {
    const standard = [];
    const convertedArgs = [];
    lodash_1.forEach(execArgv, async (arg) => {
        if (arg.indexOf('--inspect') === -1) {
            standard.push(arg);
        }
        else {
            const argName = arg.split('=')[0];
            const port = await getPort();
            convertedArgs.push(`${argName}=${port}`);
        }
    });
    return standard.concat(convertedArgs);
};
const initChild = function (child, processFile) {
    return new Promise(resolve => {
        child.send({ cmd: 'init', value: processFile }, resolve);
    });
};
class ChildPool {
    constructor() {
        this.retained = {};
        this.free = {};
    }
    async retain(processFile) {
        const _this = this;
        let child = _this.getFree(processFile).pop();
        if (child) {
            _this.retained[child.pid] = child;
            return child;
        }
        const execArgv = await convertExecArgv(process.execArgv);
        let masterFile = path.join(__dirname, './master.js');
        try {
            await stat(masterFile); // would throw if file not exists
        }
        catch (_) {
            try {
                masterFile = path.join(process.cwd(), 'dist/classes/master.js');
                await stat(masterFile);
            }
            finally {
            }
        }
        child = child_process_1.fork(masterFile, [], { execArgv });
        child.processFile = processFile;
        _this.retained[child.pid] = child;
        child.on('exit', _this.remove.bind(_this, child));
        await initChild(child, child.processFile);
        return child;
    }
    release(child) {
        delete this.retained[child.pid];
        this.getFree(child.processFile).push(child);
    }
    remove(child) {
        delete this.retained[child.pid];
        const free = this.getFree(child.processFile);
        const childIndex = free.indexOf(child);
        if (childIndex > -1) {
            free.splice(childIndex, 1);
        }
    }
    kill(child, signal) {
        child.kill(signal || 'SIGKILL');
        this.remove(child);
    }
    clean() {
        const children = lodash_1.values(this.retained).concat(this.getAllFree());
        children.forEach(child => {
            // TODO: We may want to use SIGKILL if the process does not die after some time.
            this.kill(child, 'SIGTERM');
        });
        this.retained = {};
        this.free = {};
    }
    getFree(id) {
        return (this.free[id] = this.free[id] || []);
    }
    getAllFree() {
        return lodash_1.flatten(lodash_1.values(this.free));
    }
}
exports.ChildPool = ChildPool;
exports.pool = new ChildPool();
//# sourceMappingURL=child-pool.js.map