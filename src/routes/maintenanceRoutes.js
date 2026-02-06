const express = require('express');
const router = express.Router();
const { submitCheckin, getMaintenanceHistory } = require('../controllers/maintenanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

// 1. 提交打卡 (仅限水管家和管理员)
router.post('/checkin', protect, authorize('Steward', 'Super-Admin'), submitCheckin);

// 2. 获取维护历史 (通用保护接口)
router.get('/history/:unitId', protect, getMaintenanceHistory);

module.exports = router;

