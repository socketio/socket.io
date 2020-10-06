"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentNamespace = void 0;
const namespace_1 = require("./namespace");
class ParentNamespace extends namespace_1.Namespace {
    constructor(server) {
        super(server, "/_" + ParentNamespace.count++);
        this.children = new Set();
    }
    initAdapter() { }
    emit(...args) {
        this.children.forEach(nsp => {
            nsp.rooms = this.rooms;
            nsp.flags = this.flags;
            nsp.emit.apply(nsp, args);
        });
        this.rooms.clear();
        this.flags = {};
        return this;
    }
    createChild(name) {
        const namespace = new namespace_1.Namespace(this.server, name);
        namespace.fns = this.fns.slice(0);
        this.listeners("connect").forEach(listener => 
        // @ts-ignore
        namespace.on("connect", listener));
        this.listeners("connection").forEach(listener => 
        // @ts-ignore
        namespace.on("connection", listener));
        this.children.add(namespace);
        this.server.nsps.set(name, namespace);
        return namespace;
    }
}
exports.ParentNamespace = ParentNamespace;
ParentNamespace.count = 0;
