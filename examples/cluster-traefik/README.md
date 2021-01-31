
# Socket.IO Chat with traefik & [redis](https://redis.io/)

A simple chat demo for Socket.IO

## How to use

Install [Docker Compose](https://docs.docker.com/compose/install/), then:

```
$ docker-compose up -d
```

And then point your browser to `http://localhost:3000`.

You can then scale the server to multiple instances:

```
$ docker-compose up -d --scale=server=7
```

The session stickiness, which is [required](https://socket.io/docs/v3/using-multiple-nodes/) when using multiple Socket.IO server instances, is achieved with a cookie. More information [here](https://doc.traefik.io/traefik/v2.0/routing/services/#sticky-sessions).
