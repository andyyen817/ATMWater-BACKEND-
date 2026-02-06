const express = require('express');
const router = express.Router();
const {
    getAllCards,
    getCardByNo,
    syncCard,
    importRenrenCard,
    createCard,
    chargeCard,
    bindPhysicalCard,
    unbindPhysicalCard,
    batchCreateCards,
    getCardBatches,
    getCardBatchDetail,
    getCardFullInfo,
    updateBatchStatistics,
    getBatchStatistics,
    getBatchesSummary,
    archiveBatch,
    updateBatchNotes,
    getCardSyncHistory,
    getCardStatistics,
    getCardDetailStatistics,
    createEcard,
    getEcard,
    startMaxBalanceDispense,
    getEcardBalance,
    getCardTransactionsFiltered
} = require('../controllers/renrenCardController');
const { protect, authorize } = require('../middleware/authMiddleware');
const cardSyncService = require('../services/cardSyncService');
const logger = require('../utils/logger');

// ==================== 特定路由（必须在 /:cardNo 之前）====================

/**
 * @desc    获取所有卡片列表
 * @route   GET /api/renren-cards
 * @access  Private (Admin, Super-Admin, Finance, Business)
 */
router.get('/', protect, authorize('Admin', 'Super-Admin', 'Finance', 'Business'), getAllCards);

/**
 * @desc    创建新卡片
 * @route   POST /api/renren-cards
 * @access  Private (Admin, Super-Admin, Business)
 */
router.post('/', protect, authorize('Admin', 'Super-Admin', 'Business'), createCard);

/**
 * @desc    从人人水站导入卡片（检查存在性后导入）
 * @route   POST /api/renren-cards/import
 * @access  Private (Admin, Super-Admin, Business)
 */
router.post('/import', protect, authorize('Admin', 'Super-Admin', 'Business'), importRenrenCard);

/**
 * @desc    创建电子卡（首次注册时使用）
 * @route   POST /api/renren-cards/create-ecard
 * @access  Private (所有登录用户)
 */
router.post('/create-ecard', protect, createEcard);

/**
 * @desc    查询用户的电子卡
 * @route   GET /api/renren-cards/ecard
 * @access  Private (所有登录用户)
 */
router.get('/ecard', protect, getEcard);

/**
 * @desc    绑定实物水卡到电子水卡
 * @route   POST /api/renren-cards/bind-physical
 * @access  Private (所有登录用户)
 */
router.post('/bind-physical', protect, bindPhysicalCard);

/**
 * @desc    解绑实物水卡
 * @route   POST /api/renren-cards/unbind-physical
 * @access  Private (所有登录用户)
 */
router.post('/unbind-physical', protect, unbindPhysicalCard);

/**
 * @desc    批量创建人人水站实体卡
 * @route   POST /api/renren-cards/batch-create
 * @access  Private (Admin, Super-Admin, Business)
 */
router.post('/batch-create', protect, authorize('Admin', 'Super-Admin', 'Business'), batchCreateCards);

/**
 * @desc    获取人人水站卡片批次列表
 * @route   GET /api/renren-cards/batches
 * @access  Private (Admin, Super-Admin, Business)
 */
router.get('/batches', protect, authorize('Admin', 'Super-Admin', 'Business'), getCardBatches);

/**
 * @desc    获取所有批次统计汇总
 * @route   GET /api/renren-cards/batches-summary
 * @access  Private (Admin, Super-Admin, Business)
 */
router.get('/batches-summary', protect, authorize('Admin', 'Super-Admin', 'Business'), getBatchesSummary);

/**
 * @desc    获取卡片统计数据
 * @route   GET /api/renren-cards/statistics
 * @access  Private (Admin, Super-Admin, Business)
 */
router.get('/statistics', protect, authorize('Admin', 'Super-Admin', 'Business'), getCardStatistics);

/**
 * @desc    开始最大余额出水
 * @route   POST /api/renren-cards/max-balance-dispense
 * @access  Private (所有登录用户)
 */
router.post('/max-balance-dispense', protect, startMaxBalanceDispense);

// ==================== 动态路由（包含参数）====================

/**
 * @desc    同步单个卡片
 * @route   POST /api/renren-cards/sync/:cardNo
 * @access  Private (Admin, Super-Admin)
 */
router.post('/sync/:cardNo', protect, authorize('Admin', 'Super-Admin'), syncCard);

/**
 * @desc    卡充值
 * @route   POST /api/renren-cards/charge/:cardNo
 * @access  Private (所有登录用户)
 */
router.post('/charge/:cardNo', protect, chargeCard);

/**
 * @desc    同步单张卡片的最新信息(不充值，仅同步)
 * @route   POST /api/renren-cards/:cardNo/refresh
 * @access  Private (所有登录用户)
 */
router.post('/:cardNo/refresh', protect, async (req, res) => {
    try {
        const { cardNo } = req.params;
        const userId = req.user._id;

        logger.info('[RefreshCard] 收到刷新请求', { cardNo, userId });

        const result = await cardSyncService.syncCardInfo(cardNo, userId);

        logger.info('[RefreshCard] 刷新完成', {
            cardNo,
            balance: result.data?.balance,
            unsyncCash: result.data?.unsyncCash
        });

        res.status(200).json(result);

    } catch (error) {
        logger.error('[RefreshCard] 刷新异常', {
            error: error.message
        });

        if (error.message.includes('权限')) {
            return res.status(403).json({
                success: false,
                message: error.message
            });
        }

        if (error.message.includes('不存在')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

/**
 * @desc    获取卡片待同步金额信息
 * @route   GET /api/renren-cards/:cardNo/unsync-info
 * @access  Private (所有登录用户)
 */
router.get('/:cardNo/unsync-info', protect, async (req, res) => {
    try {
        const { cardNo } = req.params;

        const result = await cardSyncService.checkUnsyncCash(cardNo);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error('[UnsyncInfo] 查询异常', {
            error: error.message
        });

        res.status(404).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @desc    获取人人水站卡片批次详情
 * @route   GET /api/renren-cards/batches/:batchId
 * @access  Private (Admin, Super-Admin, Business)
 */
router.get('/batches/:batchId', protect, authorize('Admin', 'Super-Admin', 'Business'), getCardBatchDetail);

/**
 * @desc    更新批次统计信息
 * @route   POST /api/renren-cards/batches/:batchId/update-stats
 * @access  Private (Admin, Super-Admin, Business)
 */
router.post('/batches/:batchId/update-stats', protect, authorize('Admin', 'Super-Admin', 'Business'), updateBatchStatistics);

/**
 * @desc    获取批次统计信息
 * @route   GET /api/renren-cards/batches/:batchId/statistics
 * @access  Private (Admin, Super-Admin, Business)
 */
router.get('/batches/:batchId/statistics', protect, authorize('Admin', 'Super-Admin', 'Business'), getBatchStatistics);

/**
 * @desc    归档批次
 * @route   PUT /api/renren-cards/batches/:batchId/archive
 * @access  Private (Admin, Super-Admin)
 */
router.put('/batches/:batchId/archive', protect, authorize('Admin', 'Super-Admin'), archiveBatch);

/**
 * @desc    更新批次备注
 * @route   PUT /api/renren-cards/batches/:batchId/notes
 * @access  Private (Admin, Super-Admin, Business)
 */
router.put('/batches/:batchId/notes', protect, authorize('Admin', 'Super-Admin', 'Business'), updateBatchNotes);

/**
 * @desc    获取卡片完整信息（含交易历史）
 * @route   GET /api/renren-cards/:cardNo/full-info
 * @access  Private
 */
router.get('/:cardNo/full-info', protect, getCardFullInfo);

/**
 * @desc    获取卡片同步历史
 * @route   GET /api/renren-cards/:cardNo/sync-history
 * @access  Private
 */
router.get('/:cardNo/sync-history', protect, getCardSyncHistory);

/**
 * @desc    获取卡片详细统计
 * @route   GET /api/renren-cards/:cardNo/statistics
 * @access  Private
 */
router.get('/:cardNo/statistics', protect, getCardDetailStatistics);

/**
 * @desc    获取电子卡实时余额
 * @route   GET /api/renren-cards/:cardNo/balance
 * @access  Private (所有登录用户)
 */
router.get('/:cardNo/balance', protect, getEcardBalance);

/**
 * @desc    获取卡片交易记录（过滤最大余额模式的预设交易）
 * @route   GET /api/renren-cards/:cardNo/transactions
 * @access  Private (所有登录用户)
 */
router.get('/:cardNo/transactions', protect, getCardTransactionsFiltered);

/**
 * @desc    获取单个卡片详情
 * @route   GET /api/renren-cards/:cardNo
 * @access  Private
 */
router.get('/:cardNo', protect, getCardByNo);

module.exports = router;
