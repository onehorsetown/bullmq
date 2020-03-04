export interface AdvancedOptions {
    stalledInterval?: number;
    maxStalledCount?: number;
    guardInterval?: number;
    retryProcessDelay?: number;
    backoffStrategies?: {};
    drainDelay?: number;
}
export declare const AdvancedOptionsDefaults: AdvancedOptions;
