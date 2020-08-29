import { Router } from "express";
import { pbkdf2Sync } from "crypto";
import { getClientIp } from "request-ip";
import { db_error } from "../../app";
import moment from "moment";
import authLog from "../../models/authlog";
import User from "../../models/user";

const router = Router();

router.put ("/", async (req,res) => {
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
    const { email, curpassword, newpassword } = req.body;
    const password_chk = /^.*(?=^.{8,15}$)(?=.*\d)(?=.*[a-zA-Z])(?=.*[!@#$%^&+=*()]).*$/;
    if (!(curpassword && password_chk.test(curpassword) && newpassword && password_chk.test(newpassword))) {
        _response.result = "ERR_DATA_FORMAT_INVALID";
        res.status(412).json(_response);
        return;
    } else if (curpassword === newpassword) {
        _response.result = "ERR_USER_PASSWORD_DUPLICATE";
        res.status(424).json(_response);
        return;
    } 

    /**
     * CHECK AUTHORIZATION HEADER USING BASIC AUTH
     */
    if (!(req.headers.authorization === `Basic ${process.env.ACCOUNT_BASIC_AUTH_KEY}`)) {
        _response.result = "ERR_NOT_AUTHORIZED_IDENTITY";
        res.status(403).json(_response);
        return;
    }

    /**
     * CHECK WHETHER PROVIDED EMAIL USER EXIST
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
     * SAVE LOG FUNCTION
     */
    const SAVE_LOG = (_result) => {
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
            result : _result
        });
        
        createLog.save(async (err) => {
            if (err) console.error(err);
        });
    };  

    /**
     * CHECK WHETHER CREDENTIALS USER PROVIDED ACCEPTABLE
     */
    const encryptCurPassword = pbkdf2Sync(curpassword, _user.salt, 100000, 64, "SHA512");
    const encryptNewPassword = pbkdf2Sync(newpassword, _user.salt, 100000, 64, "SHA512");
    req.body.curpassword = encryptCurPassword.toString("base64"); //HIDE INPUT_PW ON DATABASE
    req.body.newpassword = encryptNewPassword.toString("base64"); //HIDE INPUT_PW ON DATABASE
    if (encryptCurPassword.toString("base64") !== _user.password) {
        _response.result = "ERR_USER_AUTH_FAILED";
        res.status(409).json(_response);
        SAVE_LOG(_response);
        return;
    } 

    /**
     * CHANGE USER EASSWORD TASK
     */
    const _verify = await User.updateOne( {"email" : email, "password" : encryptCurPassword.toString("base64")} , {"password" : encryptNewPassword.toString("base64"), "lastlogin" : moment().format("YYYY-MM-DD HH:mm:ss")});
    if (!_verify) {
        _response.result = "ERR_USER_PASSWORD_UPDATE_FAILED";
        res.status(500).json(_response);
        SAVE_LOG(_response);
        return;
    }

    /**
     * ALL TASK FINISHED, SHOW OUTPUT
     */
    _response.result = "SUCCEED_USER_PASSWORD_CHANGED";
    res.status(200).json(_response);
    SAVE_LOG(_response);
});

export default router;