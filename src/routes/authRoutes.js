const express = require('express');
const router = express.Router();
const { 
    requestOTP, 
    verifyOTP, 
    setPassword, 
    loginWithPassword 
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/request-otp', requestOTP);
router.post('/verify-otp', verifyOTP);
router.post('/set-password', protect, setPassword);
router.post('/login-password', loginWithPassword);

module.exports = router;
