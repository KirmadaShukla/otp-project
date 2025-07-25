const axios = require("axios");
const Otp = require("../models/Otp");
const user = require("../models/user");
const jwt = require("jsonwebtoken");

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
  const { phone_no, otp } = req.body;

  if (!phone_no || !otp) {
    return res.status(400).json({ error: "Phone number and OTP are required" });
  }

  const validOtp = await Otp.findOne({ phone_no, otp });
  if (!validOtp) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  const existingUser = await user.findOne({ phone_no });

  if (existingUser) {
    // User exists, log them in
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

    // Unset the OTP field after successful login
    await Otp.updateOne({ _id: validOtp._id }, { $unset: { otp: 1 } });

    return res.status(200).json({
      message: "OTP verified successfully. User logged in.",
      token,
      user: existingUser,
    });
  } else {
    // User does not exist, OTP is valid for registration
    return res.status(200).json({
      message: "OTP verified successfully. Please complete registration.",
    });
  }
};

exports.register = async (req, res) => {
  const { phone_no, username, email, otp } = req.body;

  if (!phone_no || !username || !otp) {
    return res
      .status(400)
      .json({ error: "Phone number, username, and OTP are required" });
  }

  // Verify OTP
  const validOtp = await Otp.findOne({ phone_no, otp });
  if (!validOtp) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  // Check if user already exists
  let existingUser = await user.findOne({ phone_no });
  if (existingUser) {
    return res
      .status(400)
      .json({ error: "User with this phone number already exists." });
  }

  // Register new user
  const newUser = await user.create({
    phone_no,
    name: username,
    email: email || "",
  });

  // Unset the OTP field after successful registration
  await Otp.updateOne({ _id: validOtp._id }, { $unset: { otp: 1 } });

  return res.status(201).json({
    message: "User registered successfully. Please login.",
    user: newUser,
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
