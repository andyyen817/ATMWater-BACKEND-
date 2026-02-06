const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    任何人登录后都能访问的个人资料
router.get('/me', protect, (req, res) => {
    res.status(200).json({ success: true, data: req.user });
});

// @desc    只有 GM (总经理) 或 Super-Admin 才能访问的接口
router.get('/gm-only', protect, authorize('GM', 'Super-Admin'), (req, res) => {
    res.status(200).json({ success: true, message: 'Welcome, General Manager!' });
});

// @desc    只有 Finance (财务) 才能访问的接口
router.get('/finance-only', protect, authorize('Finance', 'Super-Admin'), (req, res) => {
    res.status(200).json({ success: true, message: 'Welcome, Finance Officer!' });
});

module.exports = router;

