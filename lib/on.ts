import type * as Emitter from "component-emitter";

export function on(
  obj: Emitter,
  ev: string,
  fn: (err?: any) => any
): VoidFunction {
  obj.on(ev, fn);
  return function subDestroy(): void {
    obj.off(ev, fn);
  };
}
