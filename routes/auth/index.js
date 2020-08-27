import { Router } from "express";
import signup from "./signup";
import active from "./active";
import login from "./login";
import jwtdecode from "./jwtdecode";
import pwdchange from "./pwdchange";
import social_kakao from "./social_kakao";

import pwdreset from "./pwdreset/";

const router = Router();
router.use ("/signup", signup);
router.use ("/active", active);
router.use ("/login", login);
router.use ("/jwtdecode",jwtdecode);
router.use ("/pwdchange", pwdchange);
router.use ("/pwdreset", pwdreset);
router.use ("/social-kakao", social_kakao);

export default router;
