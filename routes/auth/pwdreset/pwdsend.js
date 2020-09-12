import { Router } from "express";
import { randomBytes} from "crypto";
import { escape as urlencode } from "querystring";
import responseFunction from "../../coms/apiResponse";
import mailConnect from "../../coms/mailconnect";
import { getClientIp } from "request-ip";
import { readFileSync } from "fs";
import { db_error } from "../../../app";
import moment from "moment";
import authLog from "../../../models/authlog";
import Token from "../../../models/token";
import User from "../../../models/user";

const router = Router();

//# SEND PASSWORD RESET LINK TO USER
router.put ("/:email", async (req,res) => {
    //#CHECK DATABASE AND MAIL_SERVER STATE AND CHECK AUTHORIZATION HEADER USING BASIC AUTH
    const { transporter, mailerror } = await mailConnect();
    if (db_error !== null) return await responseFunction(res, 500, "ERR_DATABASE_NOT_CONNECTED");
    if (mailerror !== null) return await responseFunction(res, 500, "ERR_MAIL_SERVER_NOT_CONNECTED", null, mailerror);
    if (req.headers.authorization !== `Basic ${process.env.ACCOUNT_BASIC_AUTH_KEY}`) return await responseFunction(res, 403, "ERR_NOT_AUTHORIZED_IDENTITY");

    //#CHECK WHETHER PROVIDED EMAIL USER EXIST
    const _user = await User.findOne({"account.email" : req.params.email});
    if (_user === null || _user === undefined) return await responseFunction(res, 409, "ERR_TARGET_USER_NOT_FOUND");
    else if (_user.account.status === "rejected") return await responseFunction(res, 423, "ERR_USER_ACCESS_DENIED");
    else if (_user.account.status !== "verified") return await responseFunction(res, 409, "ERR_PASSWORD_RESET_NOT_ACCEPTED");

    //#SAVE LOG FUNCTION
    const SAVE_LOG = async (_response) => {
        const createLog = new authLog ({
            timestamp : moment().format("YYYY-MM-DD HH:mm:ss"), 
            causedby : _user.account.email,
            originip : getClientIp(req),
            category : "RESET_PASSWORD",
            response : _response
        });
        createLog.save(async (err) => {
            if (err) console.error(err);
        });
    };
    
    //#GENERATE TOKEN AND SAVE ON DATABASE
    const token = randomBytes(30); 
    const newToken = new Token ({
        owner: _user.account.email,
        type:"PWDRESET",
        token:`${token.toString("base64")}`,
        created: moment().format("YYYY-MM-DD HH:mm:ss"), 
        expired: moment().add(1,"d").format("YYYY-MM-DD HH:mm:ss") 
    });
    try {
        const verify = await newToken.save();
        if (!verify) throw (verify);
    }
    catch (save_error) {
        return await SAVE_LOG(await responseFunction(res, 424, "ERR_RESET_TOKEN_SAVE_FAILED", null, save_error));
    }

    //#SEND VERIFICATION MAIL
    try {
        const exampleEmail = readFileSync(__dirname + "/../../../models/html/email/pwdreset.html").toString();
        const emailData = exampleEmail.replace("####INPUT-YOUR-LINK_HERE####", `https://api.readlight.me/auth/pwdreset?email=${urlencode(_user.account.email)}&&token=${urlencode(token.toString("base64"))}`);
        const mailOptions = {
            from: "ReadLight<no-reply@readlight.me>",
            to: _user.account.email, 
            subject: "[ReadLight] Account Password Reset Email", 
            html: emailData
        };

        const sendMail = await transporter.sendMail(mailOptions);
        if (!sendMail) throw("UNKNOWN_MAIL_SEND_ERROR_ACCURED");
        return await SAVE_LOG(await responseFunction(res, 200, "SUCCEED_RESET_EMAIL_SENDED"));
    }
    catch (error) {
        return await SAVE_LOG(await responseFunction(res, 424, "ERR_RESET_EMAIL_SEND_FAILED", null, error));
    }
});

export default router;