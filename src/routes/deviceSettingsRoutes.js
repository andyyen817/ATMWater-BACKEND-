const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDeviceSettings,
  updateDeviceSettings,
  queryDeviceSettings
} = require('../controllers/deviceSettingsController');

// 所有路由需要GM权限
router.use(protect);
router.use(authorize('GM'));

// GET /api/admin/device-settings/:deviceId - 获取设备参数
router.get('/:deviceId', getDeviceSettings);

// POST /api/admin/device-settings/:deviceId - 更新设备参数
router.post('/:deviceId', updateDeviceSettings);

// POST /api/admin/device-settings/:deviceId/query - 从设备查询参数
router.post('/:deviceId/query', queryDeviceSettings);

module.exports = router;
