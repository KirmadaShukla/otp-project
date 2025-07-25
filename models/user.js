const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phone_no: { type: String, required: true, unique: true },
  name: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
