import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import qs from "querystring";
import fs from "fs";
import { config } from "dotenv";
import express_ejs from "ejs";
import express, { json, urlencoded } from "express";
import { connect, connection } from "mongoose";

import router from "./routes/index";

const app = express();
var db_error;
try {
    fs.statSync(path.join(__dirname, "/config/.env"));
    config({ path: path.join(__dirname, "/config/.env") });

    app.use(cors());
    app.use(json({ limit: "10mb" }));
    app.use(urlencoded({ extended: false }));
    app.use(cookieParser());

    app.use("/", router);
    app.engine("html", express_ejs.renderFile);

    //#DATABASE CONNECT WITH SSL ENCRYPTION FUNCTION
    const db_connect = () =>  {
        const mongouri = `mongodb://${process.env.DB_USER}:${qs.escape(process.env.DB_PASSWORD)}@${process.env.DB_HOST}/${process.env.DB_NAME}?authSource=${process.env.DB_AUTH_DB_NAME}`;
        connect(mongouri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            tls: true,
            tlsCAFile: process.env.DB_SSL_CERT,
            tlsCertificateKeyFile: process.env.DB_SSL_KEY
        }, (err) => {
            db_error = err;
            if (err) throw err;
            console.log("[DB] Database connected via TCP/IP on port 27017 with TLS encryption");
        });
    };
    db_connect();
}
catch (err) {
    if (err.code === "ENOENT") throw new Error ("missing \'.env\' file in \"config\" folder. please modify \'.env.sample\' file.");
    throw(err);
}

connection.on("disconnected",() => {
    console.log("[DB] Database disconnect. Trying to reconnect...");
    db_error = "disconnected";
    db_connect();
});

export {app , db_error};
