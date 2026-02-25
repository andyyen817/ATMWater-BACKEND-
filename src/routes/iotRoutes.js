const express = require('express');
const router = express.Router();
const {
    authorizeDispense,
    handleHardwareCallback,
    handleStatusPush,
    getNearbyUnits,
    getUnitDetail,
    getWaterQualityHistory
} = require('../controllers/iotController');
const { dispenseByQR, getDeviceOnlineStatus, getDispenseStatus } = require('../controllers/qrDispenseController');
const { protect } = require('../middleware/authMiddleware');

// 1. App 侧：下发取水授权指令
router.post('/authorize-dispense', protect, authorizeDispense);

// 扫码取水
router.post('/dispense/qr', protect, dispenseByQR);

// 设备在线状态查询
router.get('/device-status/:deviceId', protect, getDeviceOnlineStatus);

// 取水订单状态查询
router.get('/dispense/:orderId', protect, getDispenseStatus);

// [P3-INF-002] 附近水站查询
router.get('/nearby', getNearbyUnits);

// 获取详情和水质历史数据
router.get('/units/:id', getUnitDetail);
router.get('/water-quality/:id', getWaterQualityHistory);

// 2. 硬件平台侧：接收打水结果通知 (由人人水站服务器调用)
router.post('/callback', handleHardwareCallback);

// 3. 硬件平台侧：接收设备最新状态推送 (由人人水站服务器调用)
router.post('/status-push', handleStatusPush);

module.exports = router;