import { Router } from "express";
import { pbkdf2Sync } from "crypto";
import { getClientIp } from "request-ip";
import { db_error } from "../../../app";
import moment from "moment";
import authLog from "../../../models/authlog";
import Token from "../../../models/token";
import User from "../../../models/user";

const router = Router();

//# RESET MAIL TASK RUN
router.post ("/", async (req,res) => {
    var _response = { "result" : "ERR_SERVER_FAILED_TEMPORARILY" };

    /**
     * CHECK DATABASE STATE
     */
    if (!(db_error === null)) {
        _response.result = "ERR_DATABASE_NOT_CONNECTED";
        res.status(500).json(_response);
        return;
    }

    /**
     * CHECK WHETHER PROVIDED POST DATA IS VALID
     */
    const { email, password, token } = req.body;
    const email_chk = /^[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/i;
    const password_chk = /^.*(?=^.{8,15}$)(?=.*\d)(?=.*[a-zA-Z])(?=.*[!@#$%^&+=*()]).*$/;
    if (!(email && email_chk.test(email) && password && password_chk.test(password) && token)) {
        _response.result = "ERR_DATA_FORMAT_INVALID";
        res.status(412).json(_response);
        return;
    }

    /**
     * FIND USER ON DATABASE USING EMAIL
     */
    const _user = await User.findOne({"email" : email});
    if (!_user) {
        _response.result = "ERR_USER_NOT_FOUND";
        res.status(409).json(_response);
        return;
    } else if (_user.enable === "rejected") {
        _response.result = "ERR_USER_ACCESS_DENIED";
        res.status(423).json(_response);
        return;
    } else if (_user.enable === "kakao") {
        _response.result = "ERR_PASSWORD_RESET_NOT_ACCEPTED";
        res.status(409).json(_response);
        return;
    }

    /**
     * CHECK WHETHER TOKEN IS VALID
     */
    const _token = await Token.findOne({"owner" : email, "type" : "PWDRESET" , "token" : token });
    if (!_token) {
        _response.result = "ERR_PROVIDED_TOKEN_INVALID";
        res.status(409).json(_response);
        return;
    }
    else if (Date.parse(_token.expired) < moment()) {
        _response.result = "ERR_PROVIDED_TOKEN_INVALID";
        res.status(409).json(_response);
        return;
    }
    
    /**
     * SAVE LOG FUNCTION
     */
    const SAVE_LOG = (_result) => {
        const createLog = new authLog ({
            timestamp : moment().format("YYYY-MM-DD HH:mm:ss"), 
            causedby : email,
            originip : getClientIp(req),
            category : "PWDRESET",
            details : _token,
            result : _result
        });
        
        createLog.save(async (err) => {
            if (err) console.error(err);
        });
    };  

    const encryptPassword = pbkdf2Sync(password, _user.salt, 100000, 64, "SHA512");
    if (!encryptPassword) {
        _response.result = "ERR_PASSWORD_ENCRYPT_FAILED";
        res.status(500).json(_response);
        return;
    }

    /**
     * CHANGE USER ENABLE STATE
     */
    const _verify = await User.updateOne( {"email" : email }, {"password" : encryptPassword.toString("base64"), "lastlogin" : moment().format("YYYY-MM-DD HH:mm:ss")} );
    if (!_verify) {
        _response.result = "ERR_USER_UPDATE_FAILED";
        res.status(500).json(_response);
        SAVE_LOG(_response);
        return;
    }

    /**
     * ALL TASK FINISHED, DELETE TOKENS AND SHOW OUTPUT
     */
    await Token.deleteOne({"owner" : email, "type" : "PWDRESET", "token" : token});
    _response.result = "SUCCEED_USER_PASSWORD_CHANGED";
    res.status(200).json(_response);
    SAVE_LOG(_response);
});

export default router;