# Basic CRUD application with Socket.IO

Please read the related [guide](https://socket.io/get-started/basic-crud-application/).

This repository contains several implementations of the server:

| Directory                  | Language   | Database                                                                           | Cluster?                                                                                   |
|----------------------------|------------|------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `server/`                  | TypeScript | in-memory                                                                          | No                                                                                         |
| `server-postgres-cluster/` | JavaScript | Postgres, with the [Postgres adapter](https://socket.io/docs/v4/postgres-adapter/) | Yes, with the [`@socket.io/sticky`](https://github.com/socketio/socket.io-sticky) module)  |

## Running the frontend

```
cd angular-client
npm install
npm start
```

### Running the server

```
cd server
npm install
npm start
```
