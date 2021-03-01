import { Namespace } from "./namespace";
import type {
  DefaultEventsMap,
  EventParams,
  EventNames,
  EventsMap,
  Server,
} from "./index";
import type { BroadcastOptions } from "socket.io-adapter";

export class ParentNamespace<
  UserEvents extends EventsMap = DefaultEventsMap,
  UserEmitEvents extends EventsMap = UserEvents
> extends Namespace<UserEvents, UserEmitEvents> {
  private static count: number = 0;
  private children: Set<Namespace<UserEvents, UserEmitEvents>> = new Set();

  constructor(server: Server<UserEvents, UserEmitEvents>) {
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

  public emit<Ev extends EventNames<UserEmitEvents>>(
    ev: Ev,
    ...args: EventParams<UserEmitEvents, Ev>
  ): true {
    this.children.forEach((nsp) => {
      nsp.emit(ev, ...args);
    });

    return true;
  }

  createChild(name: string): Namespace<UserEvents, UserEmitEvents> {
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
