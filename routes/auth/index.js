import { Router } from "express";
import signup from "./signup";
import active from "./active";
import login from "./login";
import jwtdecode from "./jwtdecode";
import pwdreset from "./pwdreset";
import social_kakao from "./social_kakao";

const router = Router();
router.use ("/signup", signup);
router.use ("/active", active);
router.use ("/login", login);
router.use ("/jwtdecode",jwtdecode);
router.use ("/pwdreset", pwdreset);
router.use ("/social-kakao", social_kakao);

export default router;
