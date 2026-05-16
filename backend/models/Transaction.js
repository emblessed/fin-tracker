const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({

  userId: { type: Schema.Types.ObjectId, ref: 'User', }, 
  fileId: { type: Schema.Types.ObjectId, ref: 'File' },
  
  date: { type: Date, required: true },
  amount: { type: Number, required: true }, 
  balance: Number,
  category: { type: String, default: 'others' },
  categoryInfo: String,
  bank: String, 
  commentary: String,
  page: Number,
  transactionNum: Number,


  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  }

}, { timestamps: true });

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);