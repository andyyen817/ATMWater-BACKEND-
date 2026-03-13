// ATMWater-BACKEND/src/routes/qrRoutes.js
// QR码验证路由

const express = require('express');
const router = express.Router();
const { validateStation, validateCard } = require('../controllers/qrController');
const { protect } = require('../middleware/authMiddleware');

/**
 * 售水站QR验证（需要登录）
 * GET /api/qr/station/:deviceId
 *
 * URL参数：deviceId（Units表的deviceId字段）
 * 示例：GET /api/qr/station/869123456789001
 *
 * 对应QR码：https://iot.airkop.com/qrcode/atmwater/869123456789001
 */
router.get('/station/:deviceId', protect, validateStation);

/**
 * 物理水卡QR验证（需要登录）
 * GET /api/qr/card/:rfidCard
 *
 * URL参数：rfidCard（PhysicalCards表的rfid字段）
 * 示例：GET /api/qr/card/A87289317
 *
 * 对应QR码：https://iot.airkop.com/qrcode/card/A87289317
 */
router.get('/card/:rfidCard', protect, validateCard);

module.exports = router;
