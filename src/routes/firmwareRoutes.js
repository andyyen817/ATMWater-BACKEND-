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
  getDeviceModels
} = require('../controllers/firmwareController');

// 所有路由需要管理员权限
router.use(protect);
router.use(authorize('Admin', 'Super-Admin', 'GM'));

// 固件管理
router.post('/upload', upload.single('firmware'), uploadFirmware);
router.get('/versions', getFirmwareVersions);
router.delete('/versions/:id', deleteFirmwareVersion);

// 设备型号
router.get('/device-models', getDeviceModels);

// 设备筛选
router.post('/filter-devices', filterDevices);

// 升级任务管理
router.post('/upgrade/batch', createBatchUpgrade);
router.get('/upgrade/tasks', getUpgradeTasks);
router.post('/upgrade/cancel/:taskId', cancelUpgradeTask);

module.exports = router;
