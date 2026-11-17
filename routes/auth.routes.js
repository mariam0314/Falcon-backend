const express = require("express");
const authController = require("../controllers/auth.controller");
const { googleAuthController } = require("../controllers/googleauth.controller");
const authMiddleware  = require("../middleware/auth.middleware");
const router = express.Router();
/**
 * @route POST /api/auth/register
 * @description Initiate user registration by sending an OTP or verifying Firebase token.
 * @access Public
 */
router.post("/register", authController.userRegisterController);
/**
 * @route POST /api/auth/register/verify-otp
 * @description Verify registration OTP and create user
 * @access Public
 */
router.post("/register/verify-otp", authController.verifyRegisterOtpController);
/**
 * @route POST /api/auth/login
 * @description Initiate user login by sending an OTP or verifying Firebase token.
 * @access Public
 */
router.post("/login", authController.userLoginController);
/**
 * @route POST /api/auth/login/verify-otp
 * @description Verify login OTP and authenticate user
 * @access Public
 */
router.post("/login/verify-otp", authController.verifyLoginOtpController);
/**
 * @route POST /api/auth/demo/send-otp
 * @description Send demo OTP (1234) for email or mobile
 * @access Public
 */
router.post("/demo/send-otp", authController.demoSendOtpController);

/**
 * @route POST /api/auth/demo/verify-otp
 * @description Verify demo OTP (1234) and login/upsert user
 * @access Public
 */
router.post("/demo/verify-otp", authController.demoVerifyOtpController);

/**
 * @route POST /api/auth/google
 * @description Sign in / Sign up with Google (ID token from Google One Tap or OAuth popup)
 * @access Public
 */
router.post("/google", googleAuthController);
/**
 * @route GET /api/auth/me
 * @description Get current logged in user details
 * @access Private
 */
router.get("/me", authMiddleware.authMiddleware, authController.getMeController);
/**
 * @route POST /api/auth/logout
 * @description Logout user and invalidate refresh token
 * @access Private
 */
router.post("/logout", authMiddleware.authMiddleware, authController.userLogoutController);
/**
 * @route POST /api/auth/refresh-token
 * @description Refresh access token using refresh token
 * @access Private
 */
router.post("/refresh-token", authController.refreshAccessTokenController);
module.exports = router;