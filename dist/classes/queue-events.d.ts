import { QueueEventsOptions } from '../interfaces';
import { QueueBase } from './queue-base';
export declare class QueueEvents extends QueueBase {
    constructor(name: string, opts?: QueueEventsOptions);
    private consumeEvents;
    close(): Promise<void>;
}
