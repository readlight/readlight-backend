  import { model, Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const EmailToken = new Schema({
  created : {Type : Date, default : Date.now()},
  expired : {Type : Date, default : Date.now() + 24*60*60*1000},
  tokentype : String,
  requested_by : String,
  tokenvalue : String,
  checksum : String
});

EmailToken.plugin(mongoosePaginate);

export default model('emailtoken', EmailToken);