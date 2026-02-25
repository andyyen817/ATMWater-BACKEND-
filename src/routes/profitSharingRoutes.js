const express = require('express');
const router = express.Router();
const profitSharingController = require('../controllers/profitSharingController');
const { protect, authorize } = require('../middleware/authMiddleware');

// 区域定价管理
router.get('/regional-pricing', protect, profitSharingController.getAllRegionalPricing);
router.post('/regional-pricing', protect, authorize('Super-Admin', 'GM'), profitSharingController.createOrUpdateRegionalPricing);
router.delete('/regional-pricing/:regionCode', protect, authorize('Super-Admin'), profitSharingController.deleteRegionalPricing);

// 水站分润配置
router.get('/unit-config/:unitId', protect, profitSharingController.getUnitConfig);
router.put('/unit-config/:unitId', protect, authorize('Super-Admin', 'GM'), profitSharingController.updateUnitConfig);

// 月度销售统计
router.get('/monthly-sales/:unitId', protect, profitSharingController.getMonthlySales);
router.get('/monthly-summary', protect, profitSharingController.getMonthlySummary);

// 每日销售告警
router.get('/daily-alerts', protect, profitSharingController.getDailyAlerts);
router.post('/daily-alerts/send', protect, authorize('Super-Admin', 'GM'), profitSharingController.sendAlertManually);

// 财务明细
router.get('/financial-details', protect, profitSharingController.getFinancialDetails);
router.get('/expense-breakdown/:unitId', protect, profitSharingController.getExpenseBreakdown);

// App动态定价（公开API，无需认证）
router.get('/unit-pricing/:deviceId', profitSharingController.getUnitPricing);

module.exports = router;
