const express = require('express');
const router = express.Router();
const {
    receiveTradeNotification,
    receiveOrderNotification,
    receiveDeviceStatusNotification,
    receiveWaterQualityNotification,
    receiveFilterNotification,
    receiveDeviceOnlineNotification,
    webhookHealth
} = require('../controllers/webhookController');

/**
 * @desc    Webhook健康检查
 * @route   GET /api/webhook/health
 */
router.get('/health', webhookHealth);

/**
 * @desc    接收交易通知
 * @route   POST /api/webhook/trade
 */
router.post('/trade', receiveTradeNotification);

/**
 * @desc    接收订单通知
 * @route   POST /api/webhook/order
 */
router.post('/order', receiveOrderNotification);

/**
 * @desc    接收设备状态通知
 * @route   POST /api/webhook/device-status
 */
router.post('/device-status', receiveDeviceStatusNotification);

/**
 * @desc    接收水质数据通知
 * @route   POST /api/webhook/water-quality
 */
router.post('/water-quality', receiveWaterQualityNotification);

/**
 * @desc    接收滤芯数据通知
 * @route   POST /api/webhook/filter
 */
router.post('/filter', receiveFilterNotification);

/**
 * @desc    接收设备在线状态通知
 * @route   POST /api/webhook/device-online
 */
router.post('/device-online', receiveDeviceOnlineNotification);

module.exports = router;
