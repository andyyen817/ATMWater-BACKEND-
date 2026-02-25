const express = require('express');
const router = express.Router();
const { getRPDashboard, handleOverdue, getRPOrgTree, getRPRevenueSummary } = require('../controllers/rpController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// RP 看板
router.get('/dashboard', authorize('RP', 'Super-Admin', 'GM'), getRPDashboard);

// RP 组织树
router.get('/org-tree', authorize('RP', 'Super-Admin', 'GM'), getRPOrgTree);

// RP 收入汇总
router.get('/revenue-summary', authorize('RP', 'Super-Admin', 'GM'), getRPRevenueSummary);

// 欠费处理
router.post('/handle-overdue', authorize('RP', 'Super-Admin'), handleOverdue);

module.exports = router;
