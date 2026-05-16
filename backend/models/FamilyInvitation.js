const mongoose = require('mongoose');

const { Schema } = mongoose;

const familyInvitationSchema = new Schema(
  {
    family: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    inviter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invitedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    invitedEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
      default: 'pending',
      index: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

familyInvitationSchema.index(
  { family: 1, invitedEmail: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports =
  mongoose.models.FamilyInvitation ||
  mongoose.model('FamilyInvitation', familyInvitationSchema);
