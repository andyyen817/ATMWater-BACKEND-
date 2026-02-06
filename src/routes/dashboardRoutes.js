const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

// 所有仪表板接口需要管理员权限
router.get('/stats', protect, dashboardController.getDashboardStats);
router.get('/revenue-trend', protect, dashboardController.getRevenueTrend);
router.get('/top-rps', protect, dashboardController.getTopRPs);
router.get('/regional-distribution', protect, dashboardController.getRegionalDistribution);

// 合伙人详情（管理员接口，放在dashboard中以便于管理）
router.get('/partners/:id', protect, dashboardController.getPartnerDetail);

module.exports = router;