import { Namespace } from "./namespace";
import type { Server } from "./index";
import type { BroadcastOptions } from "socket.io-adapter";

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
    const broadcast = (packet: any, opts: BroadcastOptions) => {
      this.children.forEach((nsp) => {
        nsp.adapter.broadcast(packet, opts);
      });
    };
    // @ts-ignore FIXME is there a way to declare an inner class in TypeScript?
    this.adapter = { broadcast };
  }

  public emit(ev: string | Symbol, ...args: [...any]): true {
    this.children.forEach((nsp) => {
      nsp.emit(ev, ...args);
    });

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
