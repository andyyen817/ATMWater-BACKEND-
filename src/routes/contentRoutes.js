// ATMWater-BACKEND/src/routes/contentRoutes.js

const express = require('express');
const router = express.Router();
const { getContent, listContents, updateContent } = require('../controllers/contentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// 公开接口：用户App获取单条内容（如 GET /api/content/terms_zh）
router.get('/:key', getContent);

// 管理员接口：列出所有内容、更新内容
router.get('/', protect, authorize('Admin', 'Super-Admin'), listContents);
router.put('/:key', protect, authorize('Admin', 'Super-Admin'), updateContent);

module.exports = router;
