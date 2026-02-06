const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// 基于动态权限矩阵控制 (P1-WEB-001)
router.get('/', protect, checkPermission('view_logs'), getAuditLogs);

module.exports = router;

