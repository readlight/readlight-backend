  import { model, Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const BookShelf = new Schema({
  created : {Type : Date, default : Date.now()},
  owner : String,
  booknums : Number,
  shelfstatus : String,
  books : {Type : Array, default : []}
});

BookShelf.plugin(mongoosePaginate);

export default model('bookshelf', BookShelf);