import { model, Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const Notice = new Schema({
  generated : {Type : Date, default : Date.now()},
  notice_on : Date,
  notice_off : Date,
  title : String,
  context : String,
  targets : {
    device : Boolean,
    version: Boolean,
    location : Boolean,
    values : [
      {Type : String , default: "none"}, //device
      {Type : String , default: "none"}, //version
      {Type : String , default: "none"} // location
    ],
  },
  dismiss : Boolean
});

Notice.plugin(mongoosePaginate);

export default model('notice', Notice);