import { Router } from 'express';
import { db_error } from '../../app.js';

const router = Router();

router.get('/', function (req, res) {
    res.status(200);
    var status = {
        service : {
            status : db_error == null && true && true ? true /*develop == disable*/ ? "available" : "developing" : "unavailable",
            database : db_error == null ? "online" : "offline",
            booksystem: db_error == null && true ? "online" : "offline",
            usersystem: db_error == null && true ? "online" : "offline",
            development: db_error == null && true ? "enable" : "disable"
        },
        notice : db_error != null ? null : {
            code: "notice-20200520-131652",
            target: "target_list",
            title: "notice-testnotice",
            content: "this is sample notice",
            dismiss: "false",
            action: [
                'ACTION_1',
                'ACTION_2',
                'ACTION_3'
            ]
        } 
    }
    res.json(status);
});

export default router;