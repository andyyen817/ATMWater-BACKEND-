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
    getPermissions,
    updatePermissions
} = require('../controllers/adminController');
const { protect, authorize, checkPermission } = require('../middleware/authMiddleware');

// 所有管理端接口都需要登录
router.use(protect);

// 1. 获取 Dashboard 统计 (需要 view_dashboard 权限)
router.get('/dashboard-stats', checkPermission('view_dashboard'), getDashboardStats);

// 2. 获取所有设备列表 (需要 view_dashboard 或 manage_units 权限)
router.get('/units', checkPermission('view_dashboard'), getAllUnits);

// 2.1 获取单个设备详情
router.get('/units/:id', checkPermission('view_dashboard'), getUnitDetail);

// 2.2 导入人人水站设备
router.post('/units/import', authorize('Admin', 'Super-Admin', 'Business'), importRenrenDevice);

// 2.2 用户管理 (需要 Super-Admin 或专门的管理权限)
router.get('/users', authorize('Super-Admin', 'Admin'), getAllUsers);
router.post('/users', authorize('Super-Admin', 'Admin'), createUser);
router.put('/users/:id/role', authorize('Super-Admin'), updateUserRole);

// 3. 远程控制设备 (需要 manage_units 权限)
router.post('/units/:id/control', checkPermission('manage_units'), controlUnit);

// 4. 权限管理 (仅限 Super-Admin，不使用矩阵控制以防把自己锁死)
router.get('/permissions', authorize('Super-Admin'), getPermissions);
router.post('/permissions', authorize('Super-Admin'), updatePermissions);

module.exports = router;

