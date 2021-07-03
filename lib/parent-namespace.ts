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
  EmitEvents extends EventsMap = ListenEvents,
  ServerSideEvents extends EventsMap = DefaultEventsMap
> extends Namespace<ListenEvents, EmitEvents, ServerSideEvents> {
  private static count: number = 0;
  private children: Set<Namespace<ListenEvents, EmitEvents, ServerSideEvents>> =
    new Set();

  constructor(server: Server<ListenEvents, EmitEvents, ServerSideEvents>) {
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
  ): boolean {
    this.children.forEach((nsp) => {
      nsp.emit(ev, ...args);
    });

    return true;
  }

  createChild(
    name: string
  ): Namespace<ListenEvents, EmitEvents, ServerSideEvents> {
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
