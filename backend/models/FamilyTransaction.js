const mongoose = require('mongoose');

const { Schema } = mongoose;

const familyTransactionSchema = new Schema(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileId: {
      type: Schema.Types.ObjectId,
      ref: 'File',
      default: null,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balance: Number,
    category: {
      type: String,
      default: 'others',
    },
    categoryInfo: String,
    bank: String,
    commentary: String,
    page: Number,
    transactionNum: Number,
  },
  {
    timestamps: true,
    collection: 'family-transactions',
  }
);

familyTransactionSchema.index({ familyId: 1, date: -1 });
familyTransactionSchema.index({ familyId: 1, createdAt: -1 });

module.exports =
  mongoose.models.FamilyTransaction ||
  mongoose.model('FamilyTransaction', familyTransactionSchema);
