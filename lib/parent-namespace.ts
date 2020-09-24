import { Namespace } from "./namespace";

export class ParentNamespace extends Namespace {
  private static count: number = 0;
  private children: Set<Namespace> = new Set();

  constructor(server) {
    super(server, "/_" + ParentNamespace.count++);
  }

  initAdapter() {}

  // @ts-ignore
  public emit(...args) {
    this.children.forEach(nsp => {
      nsp.rooms = this.rooms;
      nsp.flags = this.flags;
      nsp.emit.apply(nsp, args);
    });
    this.rooms = [];
    this.flags = {};
  }

  createChild(name) {
    const namespace = new Namespace(this.server, name);
    namespace.fns = this.fns.slice(0);
    this.listeners("connect").forEach(listener =>
      // @ts-ignore
      namespace.on("connect", listener)
    );
    this.listeners("connection").forEach(listener =>
      // @ts-ignore
      namespace.on("connection", listener)
    );
    this.children.add(namespace);
    this.server.nsps[name] = namespace;
    return namespace;
  }
}
