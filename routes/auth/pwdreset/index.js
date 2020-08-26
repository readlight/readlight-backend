import { Router } from "express";
import pwdsend from "./pwdsend";
import pwdreset from "./pwdreset";

const router = Router();

router.use ("/", pwdsend);
router.use ("/", pwdreset);
router.get ("/", async (req,res) => {
    res.render(__dirname + "/../../../models/html/pwdreset.html");
});

export default router;
