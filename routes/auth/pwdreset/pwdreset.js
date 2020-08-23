import { Router } from "express";

const router = Router();

//# RESET MAIL TASK RUN
router.post ("/", async (req,res) => {
    res.end("POST");
});

export default router;