import { Router } from "express";
import { pbkdf2Sync } from "crypto";
import { getClientIp } from "request-ip";
import { db_error } from "../../app";
import moment from "moment";
import loadRegex from "../coms/loadRegex";
import responseFunction from "../coms/apiResponse";
import authLog from "../../models/authlog";
import User from "../../models/user";

const router = Router();

router.put ("/:email", async (req,res) => {
    //#CHECK DATABASE AND CHECK AUTHORIZATION HEADER USING BASIC AUTH
    if (db_error !== null) return await responseFunction(res, 500, "ERR_DATABASE_NOT_CONNECTED");
    if (req.headers.authorization !== `Basic ${process.env.ACCOUNT_BASIC_AUTH_KEY}`) return await responseFunction(res, 403, "ERR_NOT_AUTHORIZED_IDENTITY");
    
    //#CHECK WHETHER PROVIDED POST DATA IS VALID
    const { curpassword, newpassword } = req.body, { email } = req.params;
    const { emailchk, passwdchk } = await loadRegex();
    if (!(email && curpassword && newpassword)) return await responseFunction(res, 412, "ERR_DATA_NOT_PROVIDED");
    if (!(emailchk.test(email) && passwdchk.test(curpassword) && passwdchk.test(newpassword))) return await responseFunction(res, 412, "ERR_DATA_FORMAT_INVALID");
    else if (curpassword === newpassword) return await responseFunction(res, 424, "ERR_USER_PASSWORD_DUPLICATE");
    
    //#GET USER OBJECT THROUGH EMAIL
    const _user = await User.findOne({"account.email" : email}, {"_id":0});
    if (_user === null || _user === undefined) return await responseFunction(res, 409, "ERR_USER_NOT_FOUND");
    else if (_user.account.status === "rejected") return await responseFunction(res, 423, "ERR_USER_ACCESS_DENIED");
    else if (_user.account.status === "kakao") return await responseFunction(res, 409, "ERR_PASSWORD_RESET_NOT_ACCEPTED");

    //#SAVE ACCESS LOG ON DATABASE
    const SAVE_LOG = async (_response) => {
        const createLog = new authLog ({
            timestamp : moment().format("YYYY-MM-DD HH:mm:ss"), 
            causedby : email,
            originip : getClientIp(req),
            category : "PWDCHANGE",
            details : {
                "email": email,
                "password": req.body.curpassword,
                "new-password": req.body.newpassword
            },
            response : _response
        });
        await createLog.save(async (err) => {
            if (err) console.error(err);
        });
    };  

    //#CHECK WHETHER CREDENTIALS USER PROVIDED ACCEPTABLE
    const encryptCurPassword = pbkdf2Sync(curpassword, _user.auth.salt, 100000, 64, "SHA512");
    const encryptNewPassword = pbkdf2Sync(newpassword, _user.auth.salt, 100000, 64, "SHA512");
    if (!encryptCurPassword) return await responseFunction(res, 500, "ERR_PASSWORD_ENCRYPT_FAILED", null, encryptCurPassword);
    if (!encryptNewPassword) return await responseFunction(res, 500, "ERR_PASSWORD_ENCRYPT_FAILED", null, encryptNewPassword);
    req.body.curpassword = encryptCurPassword.toString("base64"); //HIDE INPUT_PW ON DATABASE
    req.body.newpassword = encryptNewPassword.toString("base64"); //HIDE INPUT_PW ON DATABASE
    if (encryptCurPassword.toString("base64") !== _user.auth.password) return await SAVE_LOG(await responseFunction(res, 409, "ERR_USER_AUTH_FAILED"));

    //#RUN USER ACCOUNT PASSWORD CHANGE TASK
    const _verify = await User.updateOne({"account.email": email, "auth.password": encryptCurPassword.toString("base64")}, {
        "auth.denied": 0,
        "auth.password": encryptNewPassword.toString("base64"),
        "auth.history.lastpwd": moment().format("YYYY-MM-DD HH:mm:ss")
    });
    if (!_verify) return await SAVE_LOG(await responseFunction(res, 500, "ERR_USER_PASSWORD_UPDATE_FAILED", null, _verify));

    //#ALL TASK FINISHED, SHOW OUTPUT
    return await SAVE_LOG(await responseFunction(res, 200, "SUCCEED_USER_PASSWORD_CHANGED"));
});

export default router;