const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getAllUnits,
    getUnitDetail,
    controlUnit,
    importRenrenDevice,
    getAllUsers,
    createUser,
    updateUserRole,
    updateUserPassword,
    getUserLogs,
    getUserTransactions,
    getUserRecharges,
    getUserCards,
    getPermissions,
    updatePermissions
} = require('../controllers/adminController');
const { generateDeviceQR, generateBatchQR } = require('../controllers/qrCodeController');
const { protect, authorize, checkPermission } = require('../middleware/authMiddleware');

// 所有管理端接口都需要登录
router.use(protect);

// 1. 获取 Dashboard 统计 (管理员可访问)
router.get('/dashboard-stats', authorize('Admin', 'Super-Admin', 'GM', 'Business'), getDashboardStats);

// 2. 获取所有设备列表 (管理员可访问)
router.get('/units', authorize('Admin', 'Super-Admin', 'GM', 'Business', 'Steward', 'RP'), getAllUnits);

// 2.0.1 设备 QR 码生成（必须在 /units/:id 之前，否则会被 :id 拦截）
router.get('/units/qrcodes/batch', authorize('Super-Admin', 'GM'), generateBatchQR);
router.get('/units/:deviceId/qrcode', authorize('Super-Admin', 'GM', 'Admin'), generateDeviceQR);

// 2.1 获取单个设备详情
router.get('/units/:id', authorize('Admin', 'Super-Admin', 'GM', 'Business', 'Steward', 'RP'), getUnitDetail);

// 2.2 导入人人水站设备
router.post('/units/import', authorize('Admin', 'Super-Admin', 'Business'), importRenrenDevice);

// 2.2 用户管理 (需要 Super-Admin 或专门的管理权限)
router.get('/users', authorize('Super-Admin', 'Admin'), getAllUsers);
router.post('/users', authorize('Super-Admin', 'Admin'), createUser);
router.put('/users/:id/role', authorize('Super-Admin'), updateUserRole);
router.put('/users/:userId/password', authorize('Super-Admin', 'Admin'), updateUserPassword);

// 2.3 用户日志查看 (需要 Super-Admin 或 Admin 权限)
router.get('/users/:userId/logs', authorize('Super-Admin', 'Admin'), getUserLogs);

// 2.4 用户详细数据查看 (需要 Super-Admin 或 Admin 权限)
router.get('/users/:userId/transactions', authorize('Super-Admin', 'Admin'), getUserTransactions);
router.get('/users/:userId/recharges', authorize('Super-Admin', 'Admin'), getUserRecharges);
router.get('/users/:userId/cards', authorize('Super-Admin', 'Admin'), getUserCards);

// 3. 远程控制设备 (需要 manage_units 权限)
router.post('/units/:id/control', checkPermission('manage_units'), controlUnit);

// 4. 权限管理 (仅限 Super-Admin，不使用矩阵控制以防把自己锁死)
router.get('/permissions', authorize('Super-Admin'), getPermissions);
router.post('/permissions', authorize('Super-Admin'), updatePermissions);

module.exports = router;

