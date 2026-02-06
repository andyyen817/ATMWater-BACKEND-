const express = require('express');
const router = express.Router();
const { getSettings, updateSetting, getWaterPricing } = require('../controllers/settingController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// APP端：获取水价（公开，无需权限）
router.get('/water_pricing', getWaterPricing);

// 管理端：需要权限
router.use(protect);
router.get('/', checkPermission('edit_prices'), getSettings);
router.post('/:key', checkPermission('edit_prices'), updateSetting);

module.exports = router;

