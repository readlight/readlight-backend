import { createServer } from "https";
import fs from "fs";
import { app } from "./app";

const port = process.env.PORT || "1000", options = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH),
    ca: fs.readFileSync(process.env.SSL_CA_PATH)
};

app.set("port", port);
const server = createServer(options, app);
const onError = (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }
  const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;

  switch (error.code) {
    case "EACCES":
      throw new Error(`${bind} requires elevated privileges`);
    case "EADDRINUSE":
      throw new Error(`${bind} is already in use`);
    default:
      throw error;
  }
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
  console.log(`Secured API Server is Running on ${bind}`);
};

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);