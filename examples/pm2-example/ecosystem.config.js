export const apps = [
  {
    name: "pm2-example",
    script: "entrypoint.js",
    // script: "fastify-entrypoint.js",
    instances: "max",
    exec_mode: "cluster",
  },
];
