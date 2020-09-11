import { Router } from "express";
import { pbkdf2Sync } from "crypto";
import { getClientIp } from "request-ip";
import { db_error } from "../../../app";
import moment from "moment";
import loadRegex from "../../coms/loadRegex";
import responseFunction from "../../coms/apiResponse";
import authLog from "../../../models/authlog";
import Token from "../../../models/token";
import User from "../../../models/user";

const router = Router();

//# RESET MAIL TASK RUN
router.post ("/", async (req,res) => {
    //#CHECK DATABASE AND MAIL_SERVER STATE AND CHECK AUTHORIZATION HEADER USING BASIC AUTH
    if (!(db_error === null)) return await responseFunction(res, 500, "ERR_DATABASE_NOT_CONNECTED");
    
    //#CHECK WHETHER PROVIDED POST DATA IS VALID
    const { email, password, token } = req.body;
    const { emailchk, passwdchk } = await loadRegex();
    if (!(email && password && token)) return await responseFunction(res, 412, "ERR_DATA_NOT_PROVIDED");
    if (!(emailchk.test(email) && passwdchk.test(password))) return await responseFunction(res, 412, "ERR_DATA_FORMAT_INVALID");

    //#GET USER OBJECT THROUGH EMAIL
    const _user = await User.findOne({"email" : email});
    if (_user === null || _user === undefined) return await responseFunction(res, 409, "ERR_USER_NOT_FOUND");
    else if (_user.enable === "rejected") return await responseFunction(res, 423, "ERR_USER_ACCESS_DENIED");
    else if (_user.enable === "kakao") return await responseFunction(res, 409, "ERR_PASSWORD_RESET_NOT_ACCEPTED");

    //#CHECK WHETHER TOKEN IS VALID
    const _token = await Token.findOne({"owner" : email, "type" : "PWDRESET", "token" : token });
    if (!_token) return await responseFunction(res, 409, "ERR_PROVIDED_TOKEN_INVALID", null);
    else if (Date.parse(_token.expired) < moment()) return await responseFunction(res, 409, "ERR_PROVIDED_TOKEN_INVALID", null);
    
    //#SAVE LOG FUNCTION
    const SAVE_LOG = async (_response) => {
        const createLog = new authLog ({
            timestamp : moment().format("YYYY-MM-DD HH:mm:ss"), 
            causedby : email,
            originip : getClientIp(req),
            category : "PWDRESET",
            details : _token,
            response : _response
        });
        await createLog.save(async (err) => {
            if (err) console.error(err);
        });
    };  

    //#UPDATE USER ACCOUNT PASSWORD AND SAVE IT ON DATABASE
    const encryptPassword = await pbkdf2Sync(password, _user.salt, 100000, 64, "SHA512");
    if (!encryptPassword) return await responseFunction(res, 500, "ERR_PASSWORD_ENCRYPT_FAILED", null, encryptPassword);
    const _verify = await User.updateOne({"email" : email }, {"password" : encryptPassword.toString("base64"), "lastlogin" : moment().format("YYYY-MM-DD HH:mm:ss")} );
    if (!_verify) return await SAVE_LOG(await responseFunction(res, 500, "ERR_USER_PASSWORD_UPDATE_FAILED", null, _verify));
    
    //#ALL TASK FINISHED, SHOW OUTPUT
    await Token.deleteOne({"owner" : email, "type" : "PWDRESET", "token" : token});
    return await SAVE_LOG(await responseFunction(res, 200, "SUCCEED_USER_PASSWORD_CHANGED"));
});

export default router;