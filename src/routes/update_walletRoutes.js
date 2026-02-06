const express = require('express');
const router = express.Router();
const { 
    createTopUp, 
    debugTopUp,
    handleWebhook,
    getBalance,
    getTransactions 
} = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

// 1. 用户侧
router.post('/topup', protect, createTopUp);
router.post('/debug-topup', protect, debugTopUp);
router.get('/balance', protect, getBalance);
router.get('/transactions', protect, getTransactions);

// 2. 支付网关侧：接收 Xendit 支付回调 (外部调用)
router.post('/webhook', handleWebhook);

module.exports = router;
