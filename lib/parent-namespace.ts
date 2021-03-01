import { Namespace } from "./namespace";
import type { Server } from "./index";
import type {
  EventParams,
  EventNames,
  EventsMap,
  DefaultEventsMap,
} from "./typed-events";
import type { BroadcastOptions } from "socket.io-adapter";

export class ParentNamespace<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents
> extends Namespace<ListenEvents, EmitEvents> {
  private static count: number = 0;
  private children: Set<Namespace<ListenEvents, EmitEvents>> = new Set();

  constructor(server: Server<ListenEvents, EmitEvents>) {
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

  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): true {
    this.children.forEach((nsp) => {
      nsp.emit(ev, ...args);
    });

    return true;
  }

  createChild(name: string): Namespace<ListenEvents, EmitEvents> {
    const namespace = new Namespace(this.server, name);
    namespace._fns = this._fns.slice(0);
    this.listeners("connect").forEach((listener) =>
      namespace.on("connect", listener)
    );
    this.listeners("connection").forEach((listener) =>
      namespace.on("connection", listener)
    );
    this.children.add(namespace);
    this.server._nsps.set(name, namespace);
    return namespace;
  }
}
