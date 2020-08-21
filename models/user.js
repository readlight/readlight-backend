import { model, Schema } from "mongoose";

const User = new Schema({
  email: String,
  password: String,
  name: String,
  phone: String,
  lastlogin: String,
  salt: String,
  enable: {
    type: Boolean,
    default: false
  }
}, {
  versionKey: false
});


export default model("user", User);