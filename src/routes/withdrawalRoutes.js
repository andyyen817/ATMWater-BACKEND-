const express = require('express');
const router = express.Router();
const { 
    requestWithdrawal, 
    getWithdrawals, 
    approveWithdrawal, 
    rejectWithdrawal,
    getWithdrawalHistory
} = require('../controllers/withdrawalController');
const { protect, authorize, checkPermission } = require('../middleware/authMiddleware');

// APP端: 发起提现
router.post('/request', protect, requestWithdrawal);
router.get('/history', protect, getWithdrawalHistory);

// WEB端: 管理提现 (基于动态权限矩阵)
router.get('/admin/list', protect, checkPermission('approve_withdrawals'), getWithdrawals);
router.post('/admin/approve/:id', protect, checkPermission('approve_withdrawals'), approveWithdrawal);
router.post('/admin/reject/:id', protect, checkPermission('approve_withdrawals'), rejectWithdrawal);

module.exports = router;

