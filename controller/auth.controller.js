const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const axios = require("axios");
const userModel = require("../models/user.model");
const {
  generateAccessToken,
  generateRefreshToken,
  generateOTP,
} = require("../helper/auth.helper");
const emailService = require("../service/email.service");
const redisClient = require("../config/redis.client");

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyB5kUme6lfUwnjJbWiMxvVPSZ3UinH_mdw";

// Redis key generators
const OTP_KEY              = (email) => `otp:${email}`;
const BLACKLIST_KEY        = (token) => `blacklist:${token}`;
const REGISTER_SESSION_KEY = (token) => `register_session:${token}`;
const LOGIN_SESSION_KEY    = (token) => `login_session:${token}`;

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes

// In-memory fallback cache when Redis is unavailable
const memoryCache = new Map();

async function safeCacheGet(key) {
  try {
    if (redisClient.isOpen) {
      return await redisClient.get(key);
    }
  } catch (_) {}
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

async function safeCacheSet(key, ttlSeconds, value) {
  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(key, ttlSeconds, value);
    }
  } catch (_) {}
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function safeCacheDel(key) {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(key);
    }
  } catch (_) {}
  memoryCache.delete(key);
}

/**
 * Verify Firebase ID Token via Google Identity Toolkit
 */
async function verifyFirebaseIdToken(firebaseToken) {
  try {
    const res = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { idToken: firebaseToken },
      { timeout: 8000 }
    );
    const fbUser = res.data?.users?.[0];
    if (fbUser) {
      return {
        phone_number: fbUser.phoneNumber,
        email: fbUser.email,
        displayName: fbUser.displayName,
        localId: fbUser.localId,
      };
    }
  } catch (err) {
    // fallback decode
  }

  try {
    const decoded = jwt.decode(firebaseToken);
    if (decoded && (decoded.phone_number || decoded.email)) {
      return {
        phone_number: decoded.phone_number,
        email: decoded.email,
        displayName: decoded.name,
      };
    }
  } catch (_) {}

  return null;
}

/**
 * @name userRegisterController
 * @description Handles user registration via Firebase token or Email OTP session
 * @route POST /api/auth/register
 * @access Public
 */
async function userRegisterController(req, res) {
  try {
    const { firebaseToken, firstname, lastname, email, mobile: directMobile } = req.body;

    // A) If Firebase Token is provided (Frontend Firebase Phone OTP flow)
    if (firebaseToken) {
      const decoded = await verifyFirebaseIdToken(firebaseToken);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid or expired Firebase token" });
      }

      const mobile = decoded.phone_number || directMobile;
      if (!mobile) {
        return res.status(400).json({ message: "Phone number not found in token" });
      }

      const userEmail = email ? email.toLowerCase().trim() : (decoded.email || undefined);

      const [mobileExists, emailExists] = await Promise.all([
        userModel.findOne({ mobile }).lean(),
        userEmail ? userModel.findOne({ email: userEmail }).lean() : Promise.resolve(null),
      ]);

      if (mobileExists) {
        return res.status(422).json({ message: "User already exists with this mobile number" });
      }
      if (emailExists) {
        return res.status(422).json({ message: "User already exists with this email address" });
      }

      const user = await userModel.create({
        firstname: firstname ? firstname.trim() : "User",
        lastname: lastname ? lastname.trim() : "",
        email: userEmail,
        mobile,
        isVerified: true,
        role: "user",
      });

      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      user.refreshToken = refreshToken;
      await user.save();

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      const userObj = user.toObject();
      delete userObj.refreshToken;

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        accessToken,
        user: userObj,
      });
    }

    // B) Direct / Email OTP registration flow
    const cleanEmail = email ? email.toLowerCase().trim() : null;
    const cleanMobile = directMobile ? directMobile.trim() : null;

    if (!cleanEmail || !cleanMobile || !firstname || !lastname) {
      return res.status(400).json({ message: "Firstname, lastname, email, and mobile are required" });
    }

    const [mobileExists, emailExists] = await Promise.all([
      userModel.findOne({ mobile: cleanMobile }).lean(),
      userModel.findOne({ email: cleanEmail }).lean(),
    ]);

    if (mobileExists) {
      return res.status(422).json({ message: "User already exists with this mobile" });
    }
    if (emailExists) {
      return res.status(422).json({ message: "User already exists with this email" });
    }

    // Rate-limit check
    const existing = await safeCacheGet(OTP_KEY(cleanEmail));
    if (existing) {
      return res.status(429).json({ message: "OTP already sent. Please wait before requesting again" });
    }

    const otp = generateOTP();
    const sessionToken = crypto.randomUUID();

    await Promise.all([
      safeCacheSet(
        OTP_KEY(cleanEmail),
        OTP_TTL_SECONDS,
        JSON.stringify({ otp, userData: { email: cleanEmail, firstname, lastname, mobile: cleanMobile } })
      ),
      safeCacheSet(
        REGISTER_SESSION_KEY(sessionToken),
        OTP_TTL_SECONDS,
        cleanEmail
      ),
    ]);

    // Send email (safe: errors logged, not fatal to local dev)
    emailService.sendRegistrationEmail(cleanEmail, firstname, otp).catch((err) => {
      console.warn("sendRegistrationEmail note (SMTP not configured or failed):", err.message);
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent for verification",
      sessionToken,
      // In development mode when SMTP may not be configured, expose OTP for testing convenience
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error("userRegisterController error:", error);
    return res.status(500).json({ message: "Registration failed. Please try again" });
  }
}

/**
 * @name verifyRegisterOtpController
 * @description Verify OTP and complete registration
 * @route POST /api/auth/register/verify-otp
 * @access Public
 */
async function verifyRegisterOtpController(req, res) {
  try {
    const { otp, sessionToken } = req.body;

    if (!otp || !sessionToken) {
      return res.status(400).json({ message: "OTP and sessionToken are required" });
    }

    const email = await safeCacheGet(REGISTER_SESSION_KEY(sessionToken));
    if (!email) {
      return res.status(400).json({ message: "Session expired. Please register again" });
    }

    const raw = await safeCacheGet(OTP_KEY(email));
    if (!raw) {
      return res.status(400).json({ message: "OTP expired or not found. Please register again" });
    }

    const record = typeof raw === "string" ? JSON.parse(raw) : raw;

    const enteredOtp = String(otp).trim();
    const isDemoOtp = enteredOtp === "1234" && process.env.NODE_ENV !== "production";

    if (String(record.otp) !== enteredOtp && !isDemoOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await userModel.create({
      ...record.userData,
      isVerified: true,
      role: "user",
    });

    await Promise.all([
      safeCacheDel(OTP_KEY(email)),
      safeCacheDel(REGISTER_SESSION_KEY(sessionToken)),
    ]);

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    const userObj = user.toObject();
    delete userObj.refreshToken;

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      accessToken,
      user: userObj,
    });
  } catch (error) {
    console.error("verifyRegisterOtpController error:", error);
    return res.status(500).json({ message: "OTP verification failed. Please try again" });
  }
}

/**
 * @name userLoginController
 * @description Initiate user login via Firebase token or Email/Phone OTP
 * @route POST /api/auth/login
 * @access Public
 */
async function userLoginController(req, res) {
  try {
    const { firebaseToken, email, phone, mobile } = req.body;

    // A) Firebase token login
    if (firebaseToken) {
      const decoded = await verifyFirebaseIdToken(firebaseToken);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid or expired Firebase token" });
      }

      const lookupPhone = decoded.phone_number || phone || mobile;
      if (!lookupPhone) {
        return res.status(400).json({ message: "Phone number not found in token" });
      }

      const user = await userModel.findOne({
        $or: [{ mobile: lookupPhone }, { phone: lookupPhone }],
      });

      if (!user) {
        return res.status(404).json({
          message: "No account found with this number",
          code: "USER_NOT_FOUND",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Your account has been deactivated" });
      }

      const accessToken  = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      user.refreshToken = refreshToken;
      await user.save();

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      const userObj = user.toObject();
      delete userObj.refreshToken;

      return res.status(200).json({
        success: true,
        message: "Login successful",
        accessToken,
        user: userObj,
      });
    }

    // B) Direct / Email OTP login
    const targetEmail = email ? email.toLowerCase().trim() : null;
    const targetPhone = phone || mobile ? (phone || mobile).trim() : null;

    if (!targetEmail && !targetPhone) {
      return res.status(400).json({ message: "Email or phone number is required" });
    }

    const query = targetEmail ? { email: targetEmail } : { $or: [{ mobile: targetPhone }, { phone: targetPhone }] };
    const user = await userModel.findOne(query).select("_id email firstname mobile isActive").lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated" });
    }

    const cacheIdentifier = user.email || user.mobile;
    const existing = await safeCacheGet(OTP_KEY(cacheIdentifier));
    if (existing) {
      return res.status(429).json({ message: "OTP already sent. Please wait before requesting again" });
    }

    const otp = generateOTP();
    const sessionToken = crypto.randomUUID();

    await Promise.all([
      safeCacheSet(
        OTP_KEY(cacheIdentifier),
        OTP_TTL_SECONDS,
        JSON.stringify({ otp, userId: user._id.toString() })
      ),
      safeCacheSet(
        LOGIN_SESSION_KEY(sessionToken),
        OTP_TTL_SECONDS,
        cacheIdentifier
      ),
    ]);

    if (user.email) {
      emailService.sendLoginEmail(user.email, otp).catch((err) => {
        console.warn("sendLoginEmail note:", err.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent for verification",
      sessionToken,
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error("userLoginController error:", error);
    return res.status(500).json({ message: "Login failed. Please try again" });
  }
}

/**
 * @name verifyLoginOtpController
 * @description Verify OTP and login user
 * @route POST /api/auth/login/verify-otp
 * @access Public
 */
async function verifyLoginOtpController(req, res) {
  try {
    const { otp, sessionToken } = req.body;

    if (!otp || !sessionToken) {
      return res.status(400).json({ message: "OTP and sessionToken are required" });
    }

    const identifier = await safeCacheGet(LOGIN_SESSION_KEY(sessionToken));
    if (!identifier) {
      return res.status(400).json({ message: "Session expired. Please login again" });
    }

    const raw = await safeCacheGet(OTP_KEY(identifier));
    if (!raw) {
      return res.status(400).json({ message: "OTP expired or not found. Please login again" });
    }

    const record = typeof raw === "string" ? JSON.parse(raw) : raw;

    const enteredOtp = String(otp).trim();
    const isDemoOtp = enteredOtp === "1234" && process.env.NODE_ENV !== "production";

    if (String(record.otp) !== enteredOtp && !isDemoOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await userModel.findById(record.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated" });
    }

    await Promise.all([
      safeCacheDel(OTP_KEY(identifier)),
      safeCacheDel(LOGIN_SESSION_KEY(sessionToken)),
    ]);

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    const userObj = user.toObject();
    delete userObj.refreshToken;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: userObj,
    });
  } catch (error) {
    console.error("verifyLoginOtpController error:", error);
    return res.status(500).json({ message: "OTP verification failed. Please try again" });
  }
}

/**
 * @name userLogoutController
 * @description Invalidate access and refresh tokens
 * @route POST /api/auth/logout
 * @access Private
 */
async function userLogoutController(req, res) {
  try {
    const accessToken  = req.token;
    const refreshToken = req.cookies.refreshToken;

    const blacklistPromises = [];

    if (accessToken) {
      const decoded = jwt.decode(accessToken);
      const ttl = decoded?.exp
        ? decoded.exp - Math.floor(Date.now() / 1000)
        : 900;
      if (ttl > 0) {
        blacklistPromises.push(safeCacheSet(BLACKLIST_KEY(accessToken), ttl, "1"));
      }
    }

    if (refreshToken) {
      const decoded = jwt.decode(refreshToken);
      const ttl = decoded?.exp
        ? decoded.exp - Math.floor(Date.now() / 1000)
        : 60 * 60 * 24 * 7;
      if (ttl > 0) {
        blacklistPromises.push(safeCacheSet(BLACKLIST_KEY(refreshToken), ttl, "1"));
      }
    }

    await Promise.all(blacklistPromises);

    if (req.user?._id) {
      await userModel.findByIdAndUpdate(req.user._id, { refreshToken: null });
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("userLogoutController error:", error);
    return res.status(500).json({ message: "Logout failed. Please try again" });
  }
}

/**
 * @name refreshAccessTokenController
 * @description Refresh access token using refresh token cookie
 * @route POST /api/auth/refresh-token
 * @access Public / Private
 */
async function refreshAccessTokenController(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token missing" });
    }

    const isBlacklisted = await safeCacheGet(BLACKLIST_KEY(refreshToken));
    if (isBlacklisted) {
      return res.status(401).json({
        message: "Refresh token has been invalidated. Please login again",
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await userModel.findById(decoded.userId).select("refreshToken isActive");

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        message: "Invalid refresh token. Please login again",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated" });
    }

    const newAccessToken = generateAccessToken(user._id);

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("refreshAccessTokenController error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Refresh token expired. Please login again",
        code: "REFRESH_TOKEN_EXPIRED",
      });
    }

    return res.status(401).json({ message: "Invalid refresh token" });
  }
}

/**
 * @name getMeController
 * @description Get current logged in user details
 * @route GET /api/auth/me
 * @access Private
 */
async function getMeController(req, res) {
  try {
    const user = await userModel
      .findById(req.user._id)
      .select("-refreshToken")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("getMeController error:", error);
    return res.status(500).json({ message: "Failed to fetch user" });
  }
}

/**
 * @name demoSendOtpController
 * @description Generates fixed demo OTP 1234 for email or mobile
 * @route POST /api/auth/demo/send-otp
 * @access Public
 */
async function demoSendOtpController(req, res) {
  try {
    const { identifier, type } = req.body;

    if (!identifier || !type) {
      return res.status(400).json({ message: "Identifier and type are required" });
    }

    let normalizedIdentifier = identifier.trim();

    if (type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedIdentifier)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      normalizedIdentifier = normalizedIdentifier.toLowerCase();
    } else if (type === "mobile") {
      const digits = normalizedIdentifier.replace(/\D/g, "");
      if (digits.length < 10) {
        return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" });
      }
      normalizedIdentifier = normalizedIdentifier.startsWith("+")
        ? normalizedIdentifier
        : `+91${digits.slice(-10)}`;
    } else {
      return res.status(400).json({ message: "Type must be 'email' or 'mobile'" });
    }

    const demoOtp = "1234";

    await safeCacheSet(
      OTP_KEY(normalizedIdentifier),
      OTP_TTL_SECONDS,
      JSON.stringify({ otp: demoOtp, identifier: normalizedIdentifier, type })
    );

    return res.status(200).json({
      success: true,
      message: "Demo OTP is 1234",
      demoOtp,
      identifier: normalizedIdentifier,
      type,
    });
  } catch (error) {
    console.error("demoSendOtpController error:", error);
    return res.status(500).json({ message: "Failed to send demo OTP" });
  }
}

/**
 * @name demoVerifyOtpController
 * @description Verifies demo OTP (1234) and authenticates/upserts user
 * @route POST /api/auth/demo/verify-otp
 * @access Public
 */
async function demoVerifyOtpController(req, res) {
  try {
    const { identifier, type, otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    if (String(otp).trim() !== "1234") {
      return res.status(400).json({ message: "Invalid OTP. Please enter the demo OTP 1234." });
    }

    if (!identifier || !type) {
      return res.status(400).json({ message: "Identifier and type are required" });
    }

    let normalizedIdentifier = identifier.trim();
    let user = null;

    if (type === "email") {
      normalizedIdentifier = normalizedIdentifier.toLowerCase();
      user = await userModel.findOne({ email: normalizedIdentifier });

      if (!user) {
        const namePart = normalizedIdentifier.split("@")[0] || "Customer";
        const firstname = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        const synthDigits = Math.floor(1000000000 + Math.random() * 9000000000);
        const synthMobile = `+91${synthDigits}`;

        user = await userModel.create({
          firstname: firstname.slice(0, 30),
          lastname: "User",
          email: normalizedIdentifier,
          mobile: synthMobile,
          isVerified: true,
          role: "user",
          accountStatus: "active",
          isActive: true,
        });
      }
    } else if (type === "mobile") {
      const digits = normalizedIdentifier.replace(/\D/g, "");
      normalizedIdentifier = normalizedIdentifier.startsWith("+")
        ? normalizedIdentifier
        : `+91${digits.slice(-10)}`;

      user = await userModel.findOne({
        $or: [{ mobile: normalizedIdentifier }, { phone: normalizedIdentifier }],
      });

      if (!user) {
        const clean10 = digits.slice(-10);
        const synthEmail = `customer_${clean10}@felcon.local`;

        user = await userModel.create({
          firstname: "Customer",
          lastname: clean10.slice(-4),
          email: synthEmail,
          mobile: normalizedIdentifier,
          isVerified: true,
          role: "user",
          accountStatus: "active",
          isActive: true,
        });
      }
    } else {
      return res.status(400).json({ message: "Invalid type. Must be 'email' or 'mobile'" });
    }

    if (!user.isActive || user.accountStatus === "banned") {
      return res.status(403).json({ message: "Your account has been deactivated" });
    }

    user.isVerified = true;

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    const userObj = user.toObject();
    delete userObj.refreshToken;

    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      accessToken,
      user: userObj,
    });
  } catch (error) {
    console.error("demoVerifyOtpController error:", error);
    return res.status(500).json({ message: "Verification failed. Please try again" });
  }
}

module.exports = {
  userRegisterController,
  verifyRegisterOtpController,
  userLoginController,
  verifyLoginOtpController,
  userLogoutController,
  refreshAccessTokenController,
  getMeController,
  demoSendOtpController,
  demoVerifyOtpController,
};
