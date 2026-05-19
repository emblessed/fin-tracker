const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    fullname: { type: String, trim: true },
    login: { type: String, trim: true, required: true, unique: true },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true },
    password: { type: String, required: true },
    gender: String,
    avatarUrl: { type: String, default: '' },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', default: null },
    settings: {
      currency: { type: String, enum: ['RUB', 'USD', 'EUR'], default: 'RUB' },
      language: { type: String, enum: ['ru', 'en'], default: 'ru' },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
      emailNotifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
