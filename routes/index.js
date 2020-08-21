import { Router } from "express";
import YAML from "yamljs";
import moment from "moment";
import timezone from "moment-timezone";
import swaggerJSDoc from "swagger-jsdoc";
import { join as pathJoin } from "path";
import { serve as swServe, setup as swSetup} from "swagger-ui-express";
import list from "./list";
import auth from "./auth";

const router = Router();

router.use("/list",list);
router.use("/auth",auth);

const swaggerDefinition = YAML.load(pathJoin(__dirname, "swagger.yaml"));
const options = {
    swaggerDefinition,
    apis: ["./auth/index.js", "./list/index.js", "./index.js"]
};

moment.tz.setDefault("Asia/Seoul");
router.use("/docs", swServe, swSetup(swaggerJSDoc(options)));
router.get("/", function (req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("<title>ReadLight RestFul API Server</title>");
    res.write("<link rel=\"icon\" href=\"https://api.readlight.me/common/icon.png\">");
    res.end("Welcome!<br>This is API Server of ReadLight");
});

export default router;