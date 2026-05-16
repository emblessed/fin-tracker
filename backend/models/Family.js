const mongoose = require('mongoose');

const { Schema } = mongoose;

const familyMemberSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const familySchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: {
      type: [familyMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'families',
  }
);

familySchema.index({ 'members.user': 1 });

module.exports = mongoose.models.Family || mongoose.model('Family', familySchema);
