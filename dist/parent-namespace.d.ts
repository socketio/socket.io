import { Namespace } from "./namespace";
export declare class ParentNamespace extends Namespace {
    private static count;
    private children;
    constructor(server: any);
    initAdapter(): void;
    emit(...args: any[]): Namespace;
    createChild(name: any): Namespace;
}
