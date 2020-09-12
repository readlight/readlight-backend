import { model, Schema } from "mongoose";

const User = new Schema({
  account: {
    email: String,
    status: {
      type: String,
      default: "unknown"
    },
    joined: String
  },
  service: {
    subscription: {
      type: String,
      default: "normal"
    }
  },
  profile: {
    name: String,
    phone: String,
    birthday : String,
    address: String
  },
  auth: {
    password: String,
    denied: {
      type: Number,
      default: 0
    },
    history: {
      lastlogin: String,
      lastpwd: String
    },
    salt: String
  }
}, {
  versionKey: false
});

export default model("user", User);