import { model, Schema } from "mongoose";

const authlog = new Schema({
    timestamp: String,
    causedby: String,
    originip: String,
    category: String,
    details: Object,
    response: Object,
    memo: String
}, {
    versionKey: false
});

export default model("authLog", authlog);