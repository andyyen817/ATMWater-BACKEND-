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
    getCheckInDetail
} = require('../controllers/stewardController');
const { protect, authorize } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// 所有管家路由都需要登录且角色为Steward
router.use(protect);
router.use(authorize('Steward'));

/**
 * @desc    获取管家设备汇总统计
 * @route   GET /api/steward/summary
 * @access  Private (Steward)
 */
router.get('/summary', getStewardSummary);

/**
 * @desc    获取管家管理的所有设备列表
 * @route   GET /api/steward/my-units
 * @access  Private (Steward)
 */
router.get('/my-units', getStewardUnits);

/**
 * @desc    获取管家管理的单个设备详情
 * @route   GET /api/steward/units/:unitId
 * @access  Private (Steward)
 */
router.get('/units/:unitId', getStewardUnitDetail);

/**
 * @desc    获取设备水质历史数据
 * @route   GET /api/steward/units/:unitId/water-quality
 * @access  Private (Steward)
 */
router.get('/units/:unitId/water-quality', getStewardUnitWaterQuality);

/**
 * @desc    管家打卡记录
 * @route   POST /api/steward/checkin
 * @access  Private (Steward)
 */
router.post('/checkin', stewardCheckIn);

/**
 * @desc    获取管家打卡历史记录
 * @route   GET /api/steward/checkin-history
 * @access  Private (Steward)
 */
router.get('/checkin-history', getStewardCheckInHistory);

/**
 * @desc    获取管家打卡统计
 * @route   GET /api/steward/checkin-statistics
 * @access  Private (Steward)
 */
router.get('/checkin-statistics', getStewardCheckInStatistics);

/**
 * @desc    获取单次打卡详情
 * @route   GET /api/steward/checkin/:id
 * @access  Private (Steward)
 */
router.get('/checkin/:id', getCheckInDetail);

module.exports = router;
