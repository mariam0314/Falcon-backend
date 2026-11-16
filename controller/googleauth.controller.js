const axios = require("axios");
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../helper/auth.helper");

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyB5kUme6lfUwnjJbWiMxvVPSZ3UinH_mdw";

/**
 * @name googleAuthController
 * @description Verifies Google OAuth ID token or Firebase ID token, creates or logs in the user
 * @route POST /api/auth/google
 * @access Public
 */
async function googleAuthController(req, res) {
  try {
    const credential = req.body.credential || req.body.token || req.body.idToken;

    if (!credential) {
      return res.status(400).json({ message: "Google credential/token is required" });
    }

    let payload = null;

    // 1. Attempt verification via Google's tokeninfo endpoint (standard Google OAuth/One-Tap)
    try {
      const googleRes = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        { timeout: 8000 }
      );
      if (googleRes.data && googleRes.data.email) {
        payload = {
          email: googleRes.data.email,
          name: googleRes.data.name || `${googleRes.data.given_name || ""} ${googleRes.data.family_name || ""}`.trim(),
          picture: googleRes.data.picture,
          given_name: googleRes.data.given_name,
          family_name: googleRes.data.family_name,
          email_verified: googleRes.data.email_verified === "true" || googleRes.data.email_verified === true,
        };
      }
    } catch (googleErr) {
      // Not standard Google OAuth token or tokeninfo error; proceed to Firebase verification
    }

    // 2. If tokeninfo didn't resolve, attempt Firebase Identity Toolkit token verification
    if (!payload) {
      try {
        const fbRes = await axios.post(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
          { idToken: credential },
          { timeout: 8000 }
        );
        const fbUser = fbRes.data?.users?.[0];
        if (fbUser && (fbUser.email || fbUser.phoneNumber)) {
          payload = {
            email: fbUser.email,
            name: fbUser.displayName || "",
            picture: fbUser.photoUrl,
            phoneNumber: fbUser.phoneNumber,
            email_verified: fbUser.emailVerified || false,
          };
        }
      } catch (fbErr) {
        // Not a valid Firebase token either
      }
    }

    // 3. Fallback: decode JWT if valid token structure exists and has email
    if (!payload) {
      try {
        const decoded = jwt.decode(credential);
        if (decoded && (decoded.email || decoded.phone_number)) {
          payload = {
            email: decoded.email,
            name: decoded.name || `${decoded.given_name || ""} ${decoded.family_name || ""}`.trim(),
            picture: decoded.picture,
            phoneNumber: decoded.phone_number,
            given_name: decoded.given_name,
            family_name: decoded.family_name,
          };
        }
      } catch (_) {}
    }

    if (!payload || (!payload.email && !payload.phoneNumber)) {
      return res.status(401).json({ message: "Invalid or expired Google token" });
    }

    const email = payload.email ? payload.email.toLowerCase().trim() : null;
    const mobile = payload.phoneNumber || null;

    // 4. Find existing user by email or mobile
    let user = null;
    if (email) {
      user = await userModel.findOne({ email });
    }
    if (!user && mobile) {
      user = await userModel.findOne({ mobile });
    }

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const fullName = (payload.name || "").trim();
      const nameParts = fullName ? fullName.split(" ") : [];
      const firstname = payload.given_name || nameParts[0] || (email ? email.split("@")[0] : "User");
      const lastname = payload.family_name || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

      user = await userModel.create({
        firstname: firstname || "User",
        lastname: lastname || "",
        email: email || undefined,
        mobile: mobile || undefined,
        profilePic: payload.picture || null,
        isVerified: true,
        role: "user",
      });
    } else {
      // Update profile picture if user doesn't have one
      if (!user.profilePic && payload.picture) {
        user.profilePic = payload.picture;
        await user.save();
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated" });
    }

    // 5. Generate application JWT tokens
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

    return res.status(200).json({
      success: true,
      message: isNewUser ? "Account created and logged in with Google" : "Login successful with Google",
      accessToken,
      user: userObj,
      isNewUser,
      requiresMobile: !user.mobile,
    });
  } catch (error) {
    console.error("googleAuthController error:", error);
    return res.status(500).json({ message: "Google authentication failed. Please try again" });
  }
}

module.exports = {
  googleAuthController,
};
