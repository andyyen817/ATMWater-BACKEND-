const express = require('express');
const router = express.Router();
const { 
    getApplications, 
    reviewApplication, 
    submitApplication,
    getMyStatus
} = require('../controllers/applicationController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// 公共/用户端路由
router.post('/apply', protect, submitApplication);
router.get('/my-status', protect, getMyStatus);

// 管理端路由
router.get('/admin/list', protect, checkPermission('manage_partners'), getApplications);
router.put('/admin/:id/review', protect, checkPermission('manage_partners'), reviewApplication);

module.exports = router;