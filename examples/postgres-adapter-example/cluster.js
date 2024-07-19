import cluster from 'node:cluster';

const SERVERS_COUNT = 3;

cluster.setupPrimary({
  exec: 'server.js',
});

for (let i = 0; i < SERVERS_COUNT; i++) {
  cluster.fork({
    PORT: 3000 + i
  });
}
