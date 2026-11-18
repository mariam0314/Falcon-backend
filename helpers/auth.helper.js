const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "falcon_jwt_access_secret_super_secure_key_2026_983742";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "falcon_jwt_refresh_secret_super_secure_key_2026_192837";

const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateOTP,
};