import { Server } from "socket.io";
import { createAdapter } from "@socket.io/postgres-adapter";
import pg from "pg";
import process from "node:process";

const PORT = process.env.PORT || 3000;

const pool = new pg.Pool({
  user: "postgres",
  host: "localhost",
  database: "postgres",
  password: "changeit",
  port: 5432,
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS socket_io_attachments (
      id          bigserial UNIQUE,
      created_at  timestamptz DEFAULT NOW(),
      payload     bytea
  );
`);

pool.on("error", (err) => {
  console.error("Postgres error", err);
});

const io = new Server({
  adapter: createAdapter(pool)
});

io.on("connection", (socket) => {
  socket.on("hello", () => {
    // send to anyone except the sender
    socket.broadcast.emit("hello", socket.id, process.pid);
  });
});

io.listen(PORT);
console.log(`server listening on port ${PORT}`);
