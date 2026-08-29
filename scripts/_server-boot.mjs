/** Boots the built serverless Express app on a port for local probing. */
import app from "../artifacts/api-server/dist/app.mjs";

const port = Number(process.env.PORT || 3899);
const server = app.listen(port, "127.0.0.1", () => {
  process.stdout.write(`BOOTED\n`);
});
server.on("error", (err) => {
  process.stderr.write(`LISTEN_ERROR ${err.message}\n`);
  process.exit(1);
});
