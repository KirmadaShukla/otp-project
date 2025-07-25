const axios = require("axios");
const Otp = require("../models/Otp");
const user = require("../models/user");

const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendOTP = async (req, res) => {
  const { phone_no } = req.body;

  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  try {
    // Save OTP to DB (Mongo)
    await Otp.deleteMany({ phone_no });
    await Otp.create({ phone_no, otp });

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your OTP is ${otp}`,
      from: process.env.TWILIO_PHONE_NO,
      to: phone_no,
    });

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Twilio OTP error:", err.message);
    res.status(500).json({ error: "Failed to send OTP" });
  }
};

exports.verifyOTP = async (req, res) => {
  const { phone_no, otp, username, email } = req.body;

  if (!phone_no || !otp) {
    return res.status(400).json({ error: "Phone number and OTP are required" });
  }

  const validOtp = await Otp.findOne({ phone_no, otp });
  if (!validOtp) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  await Otp.deleteOne({ _id: validOtp._id });

  let existingUser = await user.findOne({ phone_no });

  if (!existingUser) {
    if (!username) {
      return res
        .status(400)
        .json({ error: "Username is required for registration" });
    }

    // Register new user
    existingUser = await user.create({
      phone_no,
      username,
      email: email || "",
    });
  }

  const payload = {
    userId: existingUser._id,
    phone_no: existingUser.phone_no,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res.status(200).json({
    message: "OTP verified successfully",
    token,
    user: existingUser,
  });
};

exports.logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Failed to logout" });
  }
};
