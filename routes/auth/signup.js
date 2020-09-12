import { Router } from "express";
import { pbkdf2Sync, randomBytes, createCipheriv} from "crypto";
import { escape as urlencode } from "querystring";
import responseFunction from "../coms/apiResponse";
import mailConnect from "../coms/mailconnect";
import loadRegex from "../coms/loadRegex";
import moment from "moment";
import { getClientIp } from "request-ip";
import { readFileSync } from "fs";
import { db_error } from "../../app";
import { jwtSign } from "../coms/jwtToken.js";
import authLog from "../../models/authlog";
import Token from "../../models/token";
import User from "../../models/user";

const router = Router();
router.post ("/", async (req,res) => {
    //#CHECK DATABASE AND MAIL_SERVER STATE AND CHECK AUTHORIZATION HEADER USING BASIC AUTH
    const { transporter, mailerror } = await mailConnect();
    if (db_error !== null) return await responseFunction(res, 500, "ERR_DATABASE_NOT_CONNECTED");
    if (mailerror !== null) return await responseFunction(res, 500, "ERR_MAIL_SERVER_NOT_CONNECTED", null, mailerror);
    if (req.headers.authorization !== `Basic ${process.env.ACCOUNT_BASIC_AUTH_KEY}`) return await responseFunction(res, 403, "ERR_NOT_AUTHORIZED_IDENTITY");

    //#CHECK WHETHER PROVIDED POST DATA IS VALID
    const { email, password, name, phone } = req.body;
    const { emailchk, passwdchk, phonechk, namechk } = await loadRegex();
    if (!(email && password && name && phone)) return await responseFunction(res, 412, "ERR_DATA_NOT_PROVIDED");
    if (!(emailchk.test(email) && passwdchk.test(password) && phonechk.test(phone) && namechk.test(name))) return await responseFunction(res, 412, "ERR_DATA_FORMAT_INVALID");

    //#CHECK WHETHER EMAIL IS USED
    const _user = await User.findOne({"account.email" : email}, {"_id":0});
    if (!(_user === null || _user === undefined)) return await responseFunction(res, 409, "ERR_EMAIL_DUPLICATION");

    ///#ENCRYPT USER PASSWORD WITH RANDOM SALT
    const salt = randomBytes(32), iv = randomBytes(16);
    const encryptPassword = pbkdf2Sync(password, salt.toString("base64"), 100000, 64, "SHA512");
    if (!encryptPassword) return await responseFunction(res, 500, "ERR_PASSWORD_ENCRYPT_FAILED", null, encryptPassword);

    const cipher = createCipheriv("aes-256-cbc", Buffer.from(salt), iv);
    const encryptPhone = Buffer.concat([cipher.update(phone), cipher.final()]);
    if (!encryptPhone) return await responseFunction(res, 500, "ERR_PHONE_ENCRYPT_FAILED", null, encryptPhone);

    //#SAVE USER ACCOUNT ON DATABASE
    const createUser = new User ({
        account: {
            email,
            joined: moment().format("YYYY-MM-DD HH:mm:ss")
        },
        profile: {
            name,
            phone: `${iv.toString("hex") + ":" + encryptPhone.toString("hex")}`
        },
        auth: {
            password: `${encryptPassword.toString("base64")}`,
            salt: `${salt.toString("base64")}`
        }
    });

    //#SAVE LOG FUNCTION
    const SAVE_LOG = async (_response) => {
        const createLog = new authLog ({
            timestamp : moment().format("YYYY-MM-DD HH:mm:ss"), 
            causedby : email,
            originip : getClientIp(req),
            category : "SIGNUP",
            details : createUser,
            response : _response,
        });
        await createLog.save(async (err) => {
            if (err) console.error(err);
        });
    };

    await createUser.save(async (save_error) => {
        //#HANDLE WHEN SAVE TASK FAILED
        if (save_error) return await responseFunction(res, 500, "ERR_USER_SAVE_FAILED", null, save_error);
        
        //#GENERATE TOKEN AND SAVE ON DATABASE
        const token = randomBytes(30); 
        const newToken = new Token ({
            owner: email,
            type:"SIGNUP",
            token:`${token.toString("base64")}`,
            created: moment().format("YYYY-MM-DD HH:mm:ss"), 
            expired: moment().add(1,"d").format("YYYY-MM-DD HH:mm:ss"), 
        });
        try {
            const verify = await newToken.save();
            if (!verify) throw(verify);
        }
        catch (error) {
            return await SAVE_LOG(await responseFunction(res, 424, "ERR_AUTH_TOKEN_SAVE_FAILED", null, error));
        }

        //#SEND VERIFICATION MAIL
        try {
            const exampleEmail = readFileSync(__dirname + "/../../models/html/email/active.html").toString();
            const emailData = exampleEmail.replace("####INPUT-YOUR-LINK_HERE####", `https://api.readlight.me/auth/active?email=${urlencode(email)}&&token=${urlencode(token.toString("base64"))}`);
            const mailOptions = {
                from: "ReadLight<no-reply@readlight.me>",
                to: email, 
                subject: "[ReadLight] Account Verification Email", 
                html: emailData
            };
            createUser._id = undefined;
            createUser.auth = undefined;
            const { jwttoken, tokenerror } = await jwtSign(createUser);
            if (tokenerror !== null) return SAVE_LOG(await responseFunction(res, 500, "ERR_JWT_GENERATE_FAILED", null, tokenerror));
            
            const sendMail = await transporter.sendMail(mailOptions);
            if (!sendMail) throw("UNKNOWN_MAIL_SEND_ERROR_ACCURED");
            return await SAVE_LOG(await responseFunction(res, 200, "SUCCEED_USER_CREATED", {"token":jwttoken}));
        }
        catch (error) {
            return await SAVE_LOG(await responseFunction(res, 424, "ERR_VERIFY_EMAIL_SEND_FAILED", null, error));
        }
    });
});

export default router;