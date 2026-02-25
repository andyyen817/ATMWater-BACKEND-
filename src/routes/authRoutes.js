const express = require('express');
const router = express.Router();
const {
    requestOTP,
    verifyOTP,
    setPassword,
    loginWithPassword,
    loginWithEmail
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// WhatsApp OTP 路由
router.post('/request-whatsapp-otp', requestOTP);
router.post('/request-otp', requestOTP); // 保留旧路由兼容
router.post('/verify-otp', verifyOTP);

// 密码登录
router.post('/set-password', protect, setPassword);
router.post('/login-password', loginWithPassword);
router.post('/login-email', loginWithEmail);

module.exports = router;
