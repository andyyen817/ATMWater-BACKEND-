const express = require('express');
const router = express.Router();
const {
    createTopUp,
    getBalance,
    getTransactions
} = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

// 1. 用户侧
router.post('/topup', protect, createTopUp);
router.get('/balance', protect, getBalance);
router.get('/transactions', protect, getTransactions);

module.exports = router;
