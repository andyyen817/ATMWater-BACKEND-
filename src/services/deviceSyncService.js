const hardwareService = require('./hardwareService');
const websocketService = require('./websocketService');
const Unit = require('../models/Unit');

/**
 * 设备数据同步服务
 * 定时从人人水站API获取设备数据，更新本地数据库，并通过WebSocket推送到前端
 */
class DeviceSyncService {
    constructor() {
        this.syncInterval = null;
        this.isRunning = false;
        // 同步间隔：30秒（可根据需要调整）
        this.syncIntervalTime = 30 * 1000;
    }

    /**
     * 启动同步服务
     */
    start() {
        if (this.isRunning) {
            console.log('[Device Sync] Service already running');
            return;
        }

        this.isRunning = true;
        console.log('[Device Sync] Service started');

        // 立即执行一次同步
        this.syncAllDevices();

        // 设置定时同步
        this.syncInterval = setInterval(() => {
            this.syncAllDevices();
        }, this.syncIntervalTime);
    }

    /**
     * 停止同步服务
     */
    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        this.isRunning = false;
        console.log('[Device Sync] Service stopped');
    }

    /**
     * 同步所有设备
     */
    async syncAllDevices() {
        try {
            console.log('[Device Sync] Starting sync cycle...');

            // 获取所有本地设备
            const units = await Unit.find({});

            if (units.length === 0) {
                console.log('[Device Sync] No devices found in database');
                return;
            }

            console.log(`[Device Sync] Syncing ${units.length} devices...`);

            let successCount = 0;
            let failCount = 0;

            for (const unit of units) {
                try {
                    // 从人人水站API获取设备信息
                    const apiResponse = await hardwareService.getDeviceInfo(unit.unitId);

                    if (apiResponse.success && apiResponse.code === 0) {
                        const result = apiResponse.result;
                        const hasChanges = this.detectChanges(unit, result);

                        // 更新设备信息
                        unit.status = result.is_online ? 'Active' : 'Offline';
                        unit.lastHeartbeat = new Date();

                        // 更新传感器数据
                        if (result.sensors) {
                            unit.sensors = {
                                rawTDS: result.sensors.raw_tds || unit.sensors?.rawTDS || 0,
                                pureTDS: result.sensors.pure_tds || unit.sensors?.pureTDS || 0,
                                ph: result.sensors.ph || unit.sensors?.ph || 7.0,
                                temp: result.sensors.temp || unit.sensors?.temp || 25,
                                humidity: result.sensors.humidity || unit.sensors?.humidity || 50
                            };
                        }

                        // 更新价格和速度
                        if (result.price !== undefined) unit.price = result.price;
                        if (result.speed !== undefined) unit.speed = result.speed;

                        // 保存到数据库
                        await unit.save();

                        // 如果有变化，通过WebSocket推送到前端
                        if (hasChanges) {
                            websocketService.sendDeviceUpdate(unit.unitId, {
                                unitId: unit.unitId,
                                status: unit.status,
                                sensors: unit.sensors,
                                price: unit.price,
                                speed: unit.speed,
                                lastHeartbeat: unit.lastHeartbeat
                            });
                        }

                        successCount++;
                    } else {
                        console.error(`[Device Sync] API error for ${unit.unitId}:`, apiResponse);
                        failCount++;
                    }

                    // 避免请求过快，延迟100ms
                    await this.delay(100);
                } catch (error) {
                    console.error(`[Device Sync] Error syncing ${unit.unitId}:`, error.message);
                    failCount++;
                }
            }

            console.log(`[Device Sync] Sync cycle completed: ${successCount} success, ${failCount} failed`);

            // 发送同步完成通知
            websocketService.sendNotification('info', `设备同步完成: ${successCount}个成功, ${failCount}个失败`);

        } catch (error) {
            console.error('[Device Sync] Error in syncAllDevices:', error.message);
        }
    }

    /**
     * 检测设备数据是否有变化
     */
    detectChanges(unit, apiData) {
        // 检测状态变化
        if ((apiData.is_online && unit.status !== 'Active') ||
            (!apiData.is_online && unit.status !== 'Offline')) {
            return true;
        }

        // 检测传感器数据变化
        if (apiData.sensors) {
            const oldSensors = unit.sensors || {};
            if (apiData.sensors.raw_tds !== undefined && apiData.sensors.raw_tds !== oldSensors.rawTDS) return true;
            if (apiData.sensors.pure_tds !== undefined && apiData.sensors.pure_tds !== oldSensors.pureTDS) return true;
            if (apiData.sensors.ph !== undefined && Math.abs(apiData.sensors.ph - (oldSensors.ph || 7.0)) > 0.5) return true;
            if (apiData.sensors.temp !== undefined && Math.abs(apiData.sensors.temp - (oldSensors.temp || 25)) > 2) return true;
        }

        // 检测价格/速度变化
        if (apiData.price !== undefined && apiData.price !== unit.price) return true;
        if (apiData.speed !== undefined && apiData.speed !== unit.speed) return true;

        return false;
    }

    /**
     * 同步单个设备（用于手动触发）
     * @param {string} deviceId - 设备ID
     */
    async syncSingleDevice(deviceId) {
        try {
            console.log(`[Device Sync] Manually syncing device: ${deviceId}`);

            const unit = await Unit.findOne({ unitId: deviceId });
            if (!unit) {
                console.error(`[Device Sync] Device not found: ${deviceId}`);
                return null;
            }

            const apiResponse = await hardwareService.getDeviceInfo(deviceId);

            if (apiResponse.success && apiResponse.code === 0) {
                const result = apiResponse.result;

                unit.status = result.is_online ? 'Active' : 'Offline';
                unit.lastHeartbeat = new Date();

                if (result.sensors) {
                    unit.sensors = {
                        rawTDS: result.sensors.raw_tds || unit.sensors?.rawTDS || 0,
                        pureTDS: result.sensors.pure_tds || unit.sensors?.pureTDS || 0,
                        ph: result.sensors.ph || unit.sensors?.ph || 7.0,
                        temp: result.sensors.temp || unit.sensors?.temp || 25,
                        humidity: result.sensors.humidity || unit.sensors?.humidity || 50
                    };
                }

                if (result.price !== undefined) unit.price = result.price;
                if (result.speed !== undefined) unit.speed = result.speed;

                await unit.save();

                // 推送到前端
                websocketService.sendDeviceUpdate(deviceId, {
                    unitId: unit.unitId,
                    status: unit.status,
                    sensors: unit.sensors,
                    price: unit.price,
                    speed: unit.speed,
                    lastHeartbeat: unit.lastHeartbeat
                });

                console.log(`[Device Sync] Device ${deviceId} synced successfully`);
                return unit;
            } else {
                console.error(`[Device Sync] API error for ${deviceId}:`, apiResponse);
                return null;
            }
        } catch (error) {
            console.error(`[Device Sync] Error syncing ${deviceId}:`, error.message);
            return null;
        }
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取同步状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            syncIntervalTime: this.syncIntervalTime,
            lastSyncTime: this.lastSyncTime
        };
    }
}

module.exports = new DeviceSyncService();
