import { Namespace } from "./namespace";
import type { Server } from "./index";

export class ParentNamespace extends Namespace {
  private static count: number = 0;
  private children: Set<Namespace> = new Set();

  constructor(server: Server) {
    super(server, "/_" + ParentNamespace.count++);
  }

  /**
   * @private
   */
  _initAdapter(): void {
    /* no-op */
  }

  public emit(ev: string | Symbol, ...args: [...any]): true {
    this.children.forEach((nsp) => {
      nsp._rooms = this._rooms;
      nsp._flags = this._flags;
      nsp.emit(ev, ...args);
    });
    this._rooms.clear();
    this._flags = {};

    return true;
  }

  createChild(name: string): Namespace {
    const namespace = new Namespace(this.server, name);
    namespace._fns = this._fns.slice(0);
    this.listeners("connect").forEach((listener) =>
      namespace.on("connect", listener as (...args: any[]) => void)
    );
    this.listeners("connection").forEach((listener) =>
      namespace.on("connection", listener as (...args: any[]) => void)
    );
    this.children.add(namespace);
    this.server._nsps.set(name, namespace);
    return namespace;
  }
}
