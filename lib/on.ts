import Emitter = require("component-emitter");

export function on(obj: Emitter, ev: string, fn: (err?: any) => any) {
  obj.on(ev, fn);
  return {
    destroy: function () {
      obj.off(ev, fn);
    },
  };
}
