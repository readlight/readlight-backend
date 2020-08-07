import { model, Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const Server_LOG = new Schema({
  timestamp: { type: Date, default: Date.now() },
  causedby : String,
  originip : String,
  tasktype : {
    category : String,
    details : String,
    memo : String
  }
});

Server_LOG.plugin(mongoosePaginate);

export default model('server_log', Server_LOG);