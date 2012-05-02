
# Emitter

  Event emitter component.

## Installation

```
$ npm install emitter-component
```

## API
  
### Emitter#on(event, fn)

  Register an `event` handler `fn`.

### Emitter#once(event, fn)

  Register a single-shot `event` handler `fn`,
  removed immediately after it is invoked the
  first time.

### Emitter#off(event, fn)

  Remove `event` handler `fn`, or pass only the `event`
  name to remove all handlers for `event`.

### Emitter#emit(event, ...)

  Emit an `event` with variable option args.
