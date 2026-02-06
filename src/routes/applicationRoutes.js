const express = require('express');
const router = express.Router();
const {
    getApplications,
    reviewApplication,
    submitApplication,
    getMyStatus,
    getPendingCount
} = require('../controllers/applicationController');
const { protect, authorize, checkPermission } = require('../middleware/authMiddleware');

// 公共/用户端路由
router.post('/apply', protect, submitApplication);
router.get('/my-status', protect, getMyStatus);

// 管理端路由
router.get('/admin/list', protect, authorize('Super-Admin', 'GM', 'Business'), getApplications);
router.get('/admin/pending-count', protect, authorize('Super-Admin', 'GM', 'Business'), getPendingCount);
router.put('/admin/:id/review', protect, authorize('Super-Admin', 'GM', 'Business'), reviewApplication);

module.exports = router;
