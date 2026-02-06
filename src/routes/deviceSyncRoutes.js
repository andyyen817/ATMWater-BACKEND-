const express = require('express');
const router = express.Router();
const completeDataSyncService = require('../services/completeDataSyncService');
const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * @desc    手动同步单个设备
 * @route   POST /api/device-sync/:deviceId
 * @access  Private (Admin, Super-Admin)
 */
router.post('/:deviceId', protect, authorize('Admin', 'Super-Admin'), async (req, res) => {
    try {
        const { deviceId } = req.params;

        const result = await completeDataSyncService.syncSingleDevice(deviceId);

        if (result) {
            res.status(200).json({
                success: true,
                message: `Device ${deviceId} synced successfully`,
                data: result
            });
        } else {
            res.status(500).json({
                success: false,
                message: `Failed to sync device ${deviceId}`
            });
        }
    } catch (error) {
        console.error('[Device Sync API] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

/**
 * @desc    手动同步所有设备
 * @route   POST /api/device-sync/sync-all
 * @access  Private (Admin, Super-Admin)
 */
router.post('/sync-all', protect, authorize('Admin', 'Super-Admin'), async (req, res) => {
    try {
        // 触发异步同步
        completeDataSyncService.syncAllData();

        res.status(200).json({
            success: true,
            message: 'Complete data sync initiated for all data types'
        });
    } catch (error) {
        console.error('[Device Sync API] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

/**
 * @desc    获取同步服务状态
 * @route   GET /api/device-sync/status
 * @access  Private (Admin, Super-Admin)
 */
router.get('/status', protect, authorize('Admin', 'Super-Admin'), (req, res) => {
    try {
        const status = completeDataSyncService.getStatus();

        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('[Device Sync API] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

/**
 * @desc    重启同步服务
 * @route   POST /api/device-sync/restart
 * @access  Private (Super-Admin)
 */
router.post('/restart', protect, authorize('Super-Admin'), async (req, res) => {
    try {
        completeDataSyncService.stop();
        completeDataSyncService.start();

        res.status(200).json({
            success: true,
            message: 'Complete data sync service restarted'
        });
    } catch (error) {
        console.error('[Device Sync API] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
