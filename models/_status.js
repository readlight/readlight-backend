import { model, Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const Status = new Schema({
  statecode : Number,
  version : String,
  detail : {
    book : Boolean,
    user : Boolean,
    chat : Boolean,
    help : Boolean
  },
  notice : String
});

Status.plugin(mongoosePaginate);

export default model('_status', Status);