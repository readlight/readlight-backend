import { Router } from "express";
import pwdsend from "./pwdsend";
import pwdhtml from "./pwdhtml";
import pwdreset from "./pwdreset";

const router = Router();

router.use ("/", pwdsend);
router.use ("/", pwdhtml);
router.use ("/", pwdreset);

export default router;
