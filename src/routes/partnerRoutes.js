const express = require('express');
const router = express.Router();
const { 
    getPartnerTree, 
    getUnassignedStewards, 
    bindSteward, 
    unbindSteward 
} = require('../controllers/partnerController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// 基于动态权限矩阵控制 (P1-WEB-001)
router.use(protect);

router.get('/tree', checkPermission('manage_partners'), getPartnerTree);
router.get('/unassigned-stewards', checkPermission('manage_partners'), getUnassignedStewards);
router.post('/bind', checkPermission('manage_partners'), bindSteward);
router.post('/unbind', checkPermission('manage_partners'), unbindSteward);

module.exports = router;

