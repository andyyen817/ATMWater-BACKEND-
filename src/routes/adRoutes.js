const express = require('express');
const router = express.Router();
const { getAds, createAd, stopAd, settleAdRevenue } = require('../controllers/adController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// 根路径返回广告列表（兼容前端调用）
router.get('/', getAds);
router.get('/list', getAds);
router.post('/new', authorize('Business', 'Super-Admin'), createAd);
router.post('/stop/:id', authorize('Business', 'Super-Admin'), stopAd);
router.post('/settle', authorize('Finance', 'Super-Admin'), settleAdRevenue);

module.exports = router;

