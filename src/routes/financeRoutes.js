const express = require('express');
const router = express.Router();
const { getAllTransactions, exportTransactions, getRevenueStats } = require('../controllers/financeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// 财务接口仅限 Finance, GM 和 Super-Admin
router.use(protect);
router.use(authorize('Finance', 'GM', 'Super-Admin'));

router.get('/transactions', getAllTransactions);
router.get('/revenue', getRevenueStats);
router.get('/export', exportTransactions);

module.exports = router;

