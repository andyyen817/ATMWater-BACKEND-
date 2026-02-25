const express = require('express');
const router = express.Router();
const {
    getPartnerTree,
    getUnassignedStewards,
    bindSteward,
    unbindSteward
} = require('../controllers/partnerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// 基于角色控制
router.use(protect);

router.get('/tree', authorize('Admin', 'Super-Admin', 'GM', 'Business', 'RP'), getPartnerTree);
router.get('/unassigned-stewards', authorize('Admin', 'Super-Admin', 'GM', 'Business'), getUnassignedStewards);
router.post('/bind', authorize('Admin', 'Super-Admin', 'GM', 'Business'), bindSteward);
router.post('/unbind', authorize('Admin', 'Super-Admin', 'GM', 'Business'), unbindSteward);

module.exports = router;

