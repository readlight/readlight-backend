import { Router } from "express";
import { getClientIp } from "request-ip";
import { db_error } from "../../app";
import { randomBytes, createCipheriv} from "crypto";
import moment from "moment";
import request from "request";
import { jwtSign } from "../jwtToken";
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
     * CHECK AUTHORIZATION HEADER USING BASIC AUTH
     */
    if (!(req.headers.authorization === `Basic ${process.env.ACCOUNT_BASIC_AUTH_KEY}`)) {
        _response.result = "ERR_NOT_AUTHORIZED_IDENTITY";
        res.status(403).json(_response);
        return;
    }

    /**
     * CHECK WHETHER PROVIDED POST DATA IS VALID
     */
    const { kakaotoken } = req.body;
    if (!(kakaotoken)) {
        _response.result = "ERR_DATA_NOT_PROVIDED";
        res.status(412).json(_response);
        return;
    }

    /**
     * REQUEST USER ACCOUNT INFORMATION TO KAKAO API
     */
    const requestKakao = async () => {
        return new Promise( (result) => {
            request({
                uri: "https://kapi.kakao.com/v2/user/me",
                headers: {"Authorization": `Bearer ${kakaotoken}`}}, (error, response, body) => {
                if (!response) {
                    result(JSON.parse(`{"error":"${error}"}`));
                    return;
                }
                response.body = JSON.parse(body || "{}");
                result(response);
            });
        });
    }, { error, statusCode, body } = await requestKakao();
    if (error) {
        _response.result = "ERR_KAKAOAPI_CONNECT_FAILED";
        _response.error = error;
        res.status(500).json(_response);
        return;
    } else if (statusCode !== 200) {
        _response.result = "ERR_KAKAOAPI_TOKEN_INVALID";
        _response.error = body;
        res.status(412).json(_response);
        return;
    }

    /**
     * GENERATE USER REQUEST OBJECT
     */
    const userObject = new Object();
    try {
        userObject.email = body.kakao_account.email;
        userObject.name = body.kakao_account.profile.nickname;
        userObject.password = body.id.toString();         //SHOULD CHANGE FIELD WHEN BUSINESS APP ENABLED
        userObject.phone = body.kakao_account.birthday;      //SHOULD CHANGE FIELD WHEN BUSINESS APP ENABLED
    }
    catch (err) {
        if (err) {
            _response.result = "ERR_KAKAOAPI_USER_INVALID";
            _response.error = error;
            res.status(412).json(_response);
            return;
        }
    }

    /**
     * GENERATE JWT TOKEN WHEN USER EXIST
     */
    const _user = await User.findOne({"email" : userObject.email});
    const SAVE_LOG = (category, _response) => {
        const createLog = new authLog ({
            timestamp : moment().format("YYYY-MM-DD HH:mm:ss"), 
            causedby : userObject.email,
            originip : getClientIp(req),
            category,
            details: userObject,
            result : _response 
        });
        
        createLog.save(async (err) => {
            //# HANDLE WHEN SAVE TASK FAILED
            if (err) console.error(err);
        });
    };

    if (_user) {
        if (_user.enable === "rejected") {
            _response.result = "ERR_USER_ACCESS_DENIED";
            res.status(423).json(_response);
            return;
        }
        
        //# CHECK IF KAKAO ACCOUNT CI IS VALID
        if (!(_user.enable === "kakao" && userObject.password === _user.password)) {
            _response.result = "ERR_KAKAO_USER_MISMATCH";
            SAVE_LOG("KAKAO_LOGIN",_response);
            res.status(409).json(_response);
            return;
        }
        _response.result = "SUCCEED_USER_LOGIN";
        const update = await User.updateOne({"email": userObject.email }, {"lastlogin" : moment().format("YYYY-MM-DD HH:mm:ss")});
        if (!update) console.error(update);
        _user.password = undefined;
        _user.salt = undefined;

        //# GENERATE JWT TOKEN AND DEPLOY TO CLIENT
        const jwtresult = jwtSign(_user);
        if (!jwtresult) {
            _response.result = "ERR_JWT_GENERATE_FAILED";
            res.status(500).json(_response);
            SAVE_LOG("KAKAO_LOGIN",_response);
            return;
        }
        _response.token = jwtresult;
        res.status(200).json(_response);
        SAVE_LOG("KAKAO_LOGIN",_response);
        return; 
    }
     
    /**
     * SIGNUP NEW ACCOUNT ON DATABASE, NO VERIFICATION
     */
    const salt = randomBytes(32),iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", Buffer.from(salt), iv);
    userObject.phone = iv.toString("hex") + ":" + Buffer.concat([cipher.update(userObject.phone), cipher.final()]).toString("hex");
    if (!userObject.phone) {
        _response.result = "ERR_PHONE_ENCRYPT_FAILED";
        res.status(500).json(_response);
        return;
    }

    const createUser = new User ({
        email: `${userObject.email}`,
        password: `${userObject.password}`,
        name: `${userObject.name}`,
        phone: `${userObject.phone}`,
        salt: `${salt.toString("base64")}`,
        lastlogin : moment().format("YYYY-MM-DD HH:mm:ss"),
        enable: "kakao"
    });

    await createUser.save(async (err) => {
        //# HANDLE WHEN SAVE TASK FAILED
        if (err) {
            _response.result = "ERR_USER_SAVE_FAILED";
            _response.error = err;
            res.status(500).json("KAKAO_SIGNUP",_response);
            return;
        }

        //# GENERATE JWT TOKEN AND DEPLOY TO CLIENT
        createUser.salt = undefined;
        createUser.password = undefined;
        const jwtresult = jwtSign(createUser);
        if (!jwtresult) {
            _response.result = "ERR_SIGNEDUP_JWT_GENERATE_FAILED";
            res.status(424).json(_response);
            SAVE_LOG("KAKAO_SIGNUP",_response);
            return;
        }
        _response.result = "SUCCEED_USER_CREATED";
        _response.token = jwtresult;
        res.status(200).json(_response);
        SAVE_LOG("KAKAO_SIGNUP",_response);
    });   
});

export default router;