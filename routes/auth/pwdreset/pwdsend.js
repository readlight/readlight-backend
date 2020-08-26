import { Router } from "express";
import { randomBytes} from "crypto";
import { escape as urlencode } from "querystring";
import { createTransport } from "nodemailer";
import { getClientIp } from "request-ip";
import { readFileSync } from "fs";
import { db_error } from "../../../app";
import moment from "moment";
import Token from "../../../models/token";
import authLog from "../../../models/authlog";
import User from "../../../models/user";

const router = Router();

//# SEND PASSWORD RESET LINK TO USER
router.put ("/:email", async (req,res) => {
    var _response = { "result" : "ERR_SERVER_FAILED_TEMPORARILY" };

    /**
     * CHECK DATABASE AND MAIL_SERVER STATE
     */
    if (!(db_error === null)) {
        _response.result = "ERR_DATABASE_NOT_CONNECTED";
        res.status(500).json(_response);
        return;
    }

    const transporter = createTransport({
        host: process.env.MAIL_AUTH_SMTP_HOST,
        port: process.env.MAIL_AUTH_SMTP_PORT,
        secure: process.env.MAIL_AUTH_SMTP_SSL,
        auth: {
            user: process.env.MAIL_AUTH_USER,
            pass: process.env.MAIL_AUTH_PASSWORD
        }
    });

    try {
        const verify = await transporter.verify();
        if(!verify) throw (verify);
    }
    catch (err) {
        console.error(err);
        _response.result = "ERR_MAIL_SERVER_NOT_CONNECTED";
        res.status(500).json(_response);
        return;
    }

    /**
     * CHECK AUTHORIZATION HEADER USING BASIC AUTH
     * CHECK WHETHER PROVIDED EMAIL IS EXIST
     */
    if (!(req.headers.authorization === `Basic ${process.env.ACCOUNT_BASIC_AUTH_KEY}`)) {
        _response.result = "ERR_NOT_AUTHORIZED_IDENTITY";
        res.status(403).json(_response);
        return;
    }

    /**
     * CHECK WHETHER PROVIDED EMAIL USER EXIST
     */
    const _user = await User.findOne({"email" : req.params.email});
    if (!_user) {
        _response.result = "ERR_USER_NOT_FOUND";
        res.status(409).json(_response);
        return;
    } else if (_user.enable === "rejected") {
        _response.result = "ERR_USER_ACCESS_DENIED";
        res.status(423).json(_response);
        return;
    } else if (_user.enable !== "verified") {
        _response.result = "ERR_PASSWORD_RESET_NOT_ACCEPTED";
        res.status(409).json(_response);
        return;
    }

    /**
     * SAVE LOG FUNCTION
     */
    const SAVE_LOG = (_response) => {
        const createLog = new authLog ({
            timestamp : moment().format("YYYY-MM-DD HH:mm:ss"), 
            causedby : _user.email,
            originip : getClientIp(req),
            category : "RESET_PASSWORD",
            result : _response
        });
        createLog.save((err) => {
            if (err) console.error(err);
        });
    };
    
    /**
     * GENERATE TOKEN AND SAVE ON DATABASE
     */
    const token = randomBytes(30); 
    const newToken = new Token ({
        owner: _user.email,
        type:"PWDRESET",
        token:`${token.toString("base64")}`,
        created: moment().format("YYYY-MM-DD HH:mm:ss"), 
        expired: moment().add(1,"d").format("YYYY-MM-DD HH:mm:ss") 
    });
    try {
        const verify = await newToken.save();
        if (!verify) throw (verify);
    }
    catch (err) {
        console.error(err);
        _response.result = "ERR_RESET_TOKEN_SAVE_FAILED";
        _response.error = err;
        res.status(424).json(_response);
        SAVE_LOG(_response);
        return;
    }

    //# SEND VERIFICATION MAIL
    try {
        const exampleEmail = readFileSync(__dirname + "/../../../models/html/email/pwdreset.html").toString();
        const emailData = exampleEmail.replace("####INPUT-YOUR-LINK_HERE####", `https://api.readlight.me/auth/pwdreset?email=${urlencode(_user.email)}&&token=${urlencode(token.toString("base64"))}`);
        const mailOptions = {
            from: "ReadLight<no-reply@readlight.me>",
            to: _user.email, 
            subject: "[ReadLight] Account Password Reset Email", 
            html: emailData
        };

        const sendMail = await transporter.sendMail(mailOptions);
        if (sendMail) {
            _response.result = "SUCCEED_EMAIL_SENDED";
            res.status(200).json(_response);
            SAVE_LOG(_response);
        }
    }
    catch (err) {
        console.error(err); //SHOW ERROR FOR PM2 INSTANCE
        _response.result = "ERR_RESET_EMAIL_SEND_FAILED";
        _response.error = err.toString();
        res.status(424).json(_response);
        SAVE_LOG(_response);
    }
});

export default router;