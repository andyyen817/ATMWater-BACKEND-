const express = require('express');
const router = express.Router();
const { getRPDashboard, handleOverdue } = require('../controllers/rpController');
const { protect, authorize } = require('../middleware/authMiddleware');

// 仅限 RP 和超级管理员访问
router.get('/dashboard', protect, authorize('RP', 'Super-Admin'), getRPDashboard);
router.post('/handle-overdue', protect, authorize('RP', 'Super-Admin'), handleOverdue);

module.exports = router;

