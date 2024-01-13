
# Example with [Passport](http://www.passportjs.org/)

This example shows how to retrieve the authentication context from a basic [Express](http://expressjs.com/) + [Passport](http://www.passportjs.org/) application.

![Passport example](assets/passport_example.gif)

Please read the related guide: https://socket.io/how-to/use-with-passport

## How to use

```
$ npm ci && npm start
```

And point your browser to `http://localhost:3000`. Optionally, specify a port by supplying the `PORT` env variable.

## How it works

The Socket.IO server retrieves the user context from the session:

```js
function onlyForHandshake(middleware) {
  return (req, res, next) => {
    const isHandshake = req._query.sid === undefined;
    if (isHandshake) {
      middleware(req, res, next);
    } else {
      next();
    }
  };
}

io.engine.use(onlyForHandshake(sessionMiddleware));
io.engine.use(onlyForHandshake(passport.session()));
io.engine.use(
  onlyForHandshake((req, res, next) => {
    if (req.user) {
      next();
    } else {
      res.writeHead(401);
      res.end();
    }
  }),
);
```
