const express = require('express');
const router = express.Router();
const { getReferralStats } = require('../controllers/referralController');
const { protect } = require('../middleware/authMiddleware');

router.get('/stats', protect, getReferralStats);
router.get('/rewards', protect, getReferralStats); // Compatibility for App

module.exports = router;
