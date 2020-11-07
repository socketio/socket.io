import { Namespace } from "./namespace";

export class ParentNamespace extends Namespace {
  private static count: number = 0;
  private children: Set<Namespace> = new Set();

  constructor(server) {
    super(server, "/_" + ParentNamespace.count++);
  }

  _initAdapter() {}

  public emit(...args: any[]): boolean {
    this.children.forEach(nsp => {
      nsp._rooms = this._rooms;
      nsp._flags = this._flags;
      nsp.emit.apply(nsp, args);
    });
    this._rooms.clear();
    this._flags = {};

    return true;
  }

  createChild(name) {
    const namespace = new Namespace(this.server, name);
    namespace._fns = this._fns.slice(0);
    this.listeners("connect").forEach(listener =>
      // @ts-ignore
      namespace.on("connect", listener)
    );
    this.listeners("connection").forEach(listener =>
      // @ts-ignore
      namespace.on("connection", listener)
    );
    this.children.add(namespace);
    this.server._nsps.set(name, namespace);
    return namespace;
  }
}
