import { Emitter } from "@socket.io/component-emitter";

export function on(
  obj: Emitter<any, any>,
  ev: string,
  fn: (err?: any) => any
): VoidFunction {
  obj.on(ev, fn);
  return function subDestroy(): void {
    obj.off(ev, fn);
  };
}
