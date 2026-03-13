const express = require('express');
const router = express.Router();
const {
    getStewardUnits,
    getStewardUnitDetail,
    getStewardSummary,
    stewardCheckIn,
    getStewardUnitWaterQuality,
    getStewardCheckInHistory,
    getStewardCheckInStatistics,
    getCheckInDetail,
    getStewardRevenueSummary
} = require('../controllers/stewardController');

// 售水站管理者APP专用控制器
const {
    getDashboard,
    getRevenueRecords,
    getPhysicalCards,
    addPhysicalCard
} = require('../controllers/stewardKUDController');

const { protect, authorize } = require('../middleware/authMiddleware');

// 所有路由都需要登录
router.use(protect);

// ========================================
// 售水站管理者APP专用路由 (ATMWater-KUD)
// ========================================
router.get('/dashboard', authorize('Steward'), getDashboard);
router.get('/revenue-records', authorize('Steward'), getRevenueRecords);
router.get('/cards', authorize('Steward'), getPhysicalCards);
router.post('/cards', authorize('Steward'), addPhysicalCard);

// ========================================
// 原有管家功能路由
// ========================================
// 管家汇总和设备列表 - 允许 Steward, RP, Super-Admin, GM 访问
router.get('/summary', authorize('Steward', 'RP', 'Super-Admin', 'GM'), getStewardSummary);
router.get('/my-units', authorize('Steward', 'RP', 'Super-Admin', 'GM'), getStewardUnits);
router.get('/units/:unitId', authorize('Steward', 'RP', 'Super-Admin', 'GM'), getStewardUnitDetail);
router.get('/units/:unitId/water-quality', authorize('Steward', 'RP', 'Super-Admin', 'GM'), getStewardUnitWaterQuality);

// 收入汇总 - 仅 Steward
router.get('/revenue-summary', authorize('Steward'), getStewardRevenueSummary);

// 打卡相关 - 仅 Steward
router.post('/checkin', authorize('Steward'), stewardCheckIn);
router.get('/checkin-history', authorize('Steward'), getStewardCheckInHistory);
router.get('/checkin-statistics', authorize('Steward'), getStewardCheckInStatistics);
router.get('/checkin/:id', authorize('Steward'), getCheckInDetail);

module.exports = router;
