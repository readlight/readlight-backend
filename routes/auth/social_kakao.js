import { Router } from "express";
import { getClientIp } from "request-ip";
import { db_error } from "../../app";
import { randomBytes, createCipheriv} from "crypto";
import responseFunction from "../coms/apiResponse";
import moment from "moment";
import request from "request";
import { jwtSign } from "../coms/jwtToken";
import authLog from "../../models/authlog";
import User from "../../models/user";

const router = Router();
router.put ("/", async (req,res) => {
    //#CHECK DATABASE AND CHECK AUTHORIZATION HEADER USING BASIC AUTH
    if (!(db_error === null)) return await responseFunction(res, 500, {"msg":"ERR_DATABASE_NOT_CONNECTED"}, null);
    if (!(req.headers.authorization === `Basic ${process.env.ACCOUNT_BASIC_AUTH_KEY}`)) return await responseFunction(res, 403, {"msg":"ERR_NOT_AUTHORIZED_IDENTITY"}, null);
    
    //#CHECK WHETHER PROVIDED POST DATA IS VALID
    const { kakaotoken } = req.body;
    if (!(kakaotoken)) return await responseFunction(res, 412, {"msg":"ERR_DATA_NOT_PROVIDED"}, null);

    //#REQUEST USER ACCOUNT INFORMATION TO KAKAO API
    const requestKakao = async () => {
        return new Promise(async (result) => {
            await request({
                uri: "https://kapi.kakao.com/v2/user/me",
                headers: {"Authorization": `Bearer ${kakaotoken}`}}, async (error, response, body) => {
                if (!response) return await result(JSON.parse(`{"error":"${error}"}`));
                response.body = JSON.parse(body || "{}");
                await result(response);
            });
        });
    }, { error, statusCode, body } = await requestKakao();
    if (error) return await responseFunction(res, 500, {"msg":"ERR_KAKAOAPI_CONNECT_FAILED"}, null, error);
    else if (statusCode !== 200) return await responseFunction(res, 412, {"msg":"ERR_KAKAOAPI_TOKEN_INVALID"}, null, body);
    
    //#GENERATE USER REQUEST OBJECT
    const userObject = new Object();
    try {
        userObject.email = body.kakao_account.email;
        userObject.name = body.kakao_account.profile.nickname;
        userObject.password = body.id.toString();            //SHOULD CHANGE FIELD WHEN BUSINESS APP ENABLED
        userObject.phone = body.kakao_account.birthday;      //SHOULD CHANGE FIELD WHEN BUSINESS APP ENABLED
    }
    catch (kakao_user_error) {
        return await responseFunction(res, 412, {"msg":"ERR_KAKAOAPI_USER_INVALID"}, null, kakao_user_error);
    }

    //#GENERATE JWT TOKEN WHEN USER EXIST
    const _user = await User.findOne({"email" : userObject.email});
    const SAVE_LOG = async (category, _response) => {
        const createLog = new authLog ({
            timestamp : moment().format("YYYY-MM-DD HH:mm:ss"), 
            causedby : userObject.email,
            originip : getClientIp(req),
            category,
            details: userObject,
            response : _response 
        });
        await createLog.save(async (err) => {
            if (err) console.error(err);
        });
    };

    //#LOGIN WHEN USER EXIST
    if (!(_user === null || _user === undefined)) {
        if (_user.enable === "rejected") return await responseFunction(res, 423, {"msg":"ERR_USER_ACCESS_DENIED"}, null);
        
        //#CHECK IF KAKAO ACCOUNT CI IS VALID
        if (!(_user.enable === "kakao" && userObject.password === _user.password))
            return await SAVE_LOG("KAKAO_LOGIN", await responseFunction(res, 409,{"msg":"ERR_KAKAO_USER_MISMACH"}, null));

        //#UPDATE LAST_LOGIN FIELD
        const _update = await User.updateOne({"email": userObject.email }, {"lastlogin" : moment().format("YYYY-MM-DD HH:mm:ss")});
        if (!_update) return await responseFunction(res, 500, {"msg":"ERR_USER_LOGIN_UPDATE_FAILED"}, null, _update);

        //#GENERATE JWT TOKEN AND DEPLOY TO CLIENT
        _user.password = undefined;
        _user.salt = undefined;
        const { jwttoken, tokenerror } = await jwtSign(_user);
        if (!(tokenerror === null)) return await SAVE_LOG("KAKAO_LOGIN", await responseFunction(res, 500, {"msg":"ERR_JWT_GENERATE_FAILED"}, jwttoken, tokenerror));
        return await SAVE_LOG("KAKAO_LOGIN", await responseFunction(res, 200, {"msg":"SUCCEED_KAKAO_USER_LOGIN"}, jwttoken));
    }
     
    //#SIGNUP NEW ACCOUNT ON DATABASE, NO VERIFICATION
    const salt = await randomBytes(32), iv = await randomBytes(16);
    const cipher = await createCipheriv("aes-256-cbc", Buffer.from(salt), iv);
    userObject.phone = iv.toString("hex") + ":" + Buffer.concat([cipher.update(userObject.phone), cipher.final()]).toString("hex");
    if (!userObject.phone) return await responseFunction(res, 500, {"msg":"ERR_PHONE_ENCRYPT_FAILED"}, null, userObject.phone);
    
    //#SAVE USER ACCOUNT ON DATABASE
    const createUser = new User ({
        email: `${userObject.email}`,
        password: `${userObject.password}`,
        name: `${userObject.name}`,
        phone: `${userObject.phone}`,
        salt: `${salt.toString("base64")}`,
        lastlogin : moment().format("YYYY-MM-DD HH:mm:ss"),
        enable: "kakao"
    });

    await createUser.save(async (save_error) => {
        //#HANDLE WHEN SAVE TASK FAILED
        if (save_error) return await responseFunction(res, 500, {"msg":"ERR_USER_SAVE_FAILED"}, null, save_error);

        //#GENERATE JWT TOKEN AND DEPLOY TO CLIENT
        createUser.salt = undefined;
        createUser.password = undefined;
        const { jwttoken, tokenerror } = await jwtSign(createUser);
        if (!(tokenerror === null)) return await SAVE_LOG("KAKAO_SIGNUP", await responseFunction(res, 500, {"msg":"ERR_JWT_GENERATE_FAILED"}, jwttoken, tokenerror));
        return await SAVE_LOG("KAKAO_SIGNUP", await responseFunction(res, 200, {"msg":"SUCCEED_USER_CREATED"}, jwttoken));
    });   
});

export default router;