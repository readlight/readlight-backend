import { Router } from "express";

const router = Router();

//# HAMDLE PASSWORD RESET LINK THROUGH HTML
router.get ("/", async (req,res) => {
    res.render(__dirname + "/../../../models/html/pwdreset.html");
});

export default router;