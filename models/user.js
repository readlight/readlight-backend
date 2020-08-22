import { model, Schema } from "mongoose";

const User = new Schema({
  email: String,
  password: String,
  name: String,
  phone: String,
  lastlogin: String,
  salt: String,
  enable: {
    type: String,
    default: "unknown"
  }
}, {
  versionKey: false
});


export default model("user", User);