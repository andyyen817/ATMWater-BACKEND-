const express = require('express');
const router = express.Router();
const { 
    generateBatch, 
    getBatches, 
    getBatchCards,
    linkCard
} = require('../controllers/cardController');
const { protect, authorize } = require('../middleware/authMiddleware');

// 所有接口都需要登录
router.use(protect);

// 1. 生成批次 (仅限 Admin/Super-Admin)
router.post('/generate', authorize('Super-Admin', 'Admin', 'Business'), generateBatch);

// 2. 获取所有批次
router.get('/batches', authorize('Super-Admin', 'Admin', 'Business', 'Finance'), getBatches);

// 3. 获取批次内的卡片详情 (用于导出)
router.get('/batches/:id/cards', authorize('Super-Admin', 'Admin', 'Business'), getBatchCards);

// 4. 用户绑定卡片 (所有登录用户)
router.post('/link', linkCard);

module.exports = router;
