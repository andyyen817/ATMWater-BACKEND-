const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  uploadFirmware,
  getFirmwareVersions,
  deleteFirmwareVersion,
  filterDevices,
  createBatchUpgrade,
  getUpgradeTasks,
  cancelUpgradeTask,
  retryUpgradeTask,
  deleteUpgradeTask,
  getDeviceModels
} = require('../controllers/firmwareController');

// 所有路由需要管理员权限
router.use(protect);
router.use(authorize('Admin', 'Super-Admin', 'GM'));

// 固件管理
router.post('/upload', upload.single('firmware'), uploadFirmware);
router.get('/versions', getFirmwareVersions);
router.get('/list', getFirmwareVersions);             // 前端兼容路由
router.delete('/versions/:id', deleteFirmwareVersion);
router.delete('/:id', deleteFirmwareVersion);         // 前端兼容路由 DELETE /api/firmware/:id

// 设备型号
router.get('/device-models', getDeviceModels);

// 设备筛选
router.post('/filter-devices', filterDevices);

// 升级任务管理（具体路由必须放在参数路由之前）
router.post('/upgrade/batch', createBatchUpgrade);
router.post('/upgrade', createBatchUpgrade);          // 前端兼容路由
router.get('/upgrade/tasks', getUpgradeTasks);
router.get('/upgrades', getUpgradeTasks);             // 前端兼容路由
router.post('/upgrade/:taskId/cancel', cancelUpgradeTask);  // 前端调用格式
router.post('/upgrade/:taskId/retry', retryUpgradeTask);    // 前端调用格式
router.delete('/upgrade/:taskId', deleteUpgradeTask);       // 删除已完成/失败任务
router.post('/upgrade/cancel/:taskId', cancelUpgradeTask);  // 旧格式兼容

module.exports = router;
