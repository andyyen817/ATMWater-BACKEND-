const renrenWaterService = require('./renrenWaterService');
const websocketService = require('./websocketService');
const Unit = require('../models/Unit');
const RenrenCard = require('../models/RenrenCard');
const RenrenTransaction = require('../models/RenrenTransaction');

/**
 * 完整数据同步服务
 * 将人人水站的所有数据同步到本地MongoDB
 */
class CompleteDataSyncService {
    constructor() {
        this.syncIntervals = {};
        this.isRunning = false;
    }

    /**
     * 启动完整数据同步服务
     */
    start() {
        if (this.isRunning) {
            console.log('[DataSync] Service already running');
            return;
        }

        this.isRunning = true;
        console.log('[DataSync] Complete data sync service started');

        // 立即执行一次完整同步
        this.syncAllData();

        // 设置定时同步
        // 设备状态同步 - 每30秒
        this.syncIntervals.devices = setInterval(() => {
            this.syncAllDevices();
        }, 30000);

        // 用户电子卡同步 - 每1分钟（高频，用于实时余额更新）
        this.syncIntervals.userEcards = setInterval(() => {
            this.syncUserEcards();
        }, 60 * 1000);

        // 卡片数据同步 - 每5分钟
        this.syncIntervals.cards = setInterval(() => {
            this.syncAllCards();
        }, 5 * 60 * 1000);

        // 交易记录同步 - 每10分钟
        this.syncIntervals.transactions = setInterval(() => {
            this.syncAllTransactions();
        }, 10 * 60 * 1000);

        // 滤芯数据同步 - 每1小时
        this.syncIntervals.filters = setInterval(() => {
            this.syncAllFilters();
        }, 60 * 60 * 1000);

        console.log('[DataSync] All sync intervals started');
    }

    /**
     * 停止同步服务
     */
    stop() {
        Object.values(this.syncIntervals).forEach(interval => {
            clearInterval(interval);
        });

        this.isRunning = false;
        console.log('[DataSync] Complete data sync service stopped');
    }

    /**
     * 同步所有数据
     */
    async syncAllData() {
        console.log('[DataSync] Starting complete data sync...');

        try {
            await this.syncAllDevices();
            await this.syncAllCards();
            // 交易记录通过Webhook实时获取，这里不需要同步
            await this.syncAllFilters();
        } catch (error) {
            console.error('[DataSync] Error in complete sync:', error.message);
        }
    }

    /**
     * 同步所有设备数据
     */
    async syncAllDevices() {
        try {
            console.log('[DataSync] Syncing all devices...');

            const units = await Unit.find({});
            let successCount = 0;
            let failCount = 0;

            for (const unit of units) {
                try {
                    // 1. 获取设备基本信息
                    const deviceInfo = await renrenWaterService.getDeviceInfo(unit.unitId);

                    if (deviceInfo.success && deviceInfo.code === 0) {
                        const result = deviceInfo.result;

                        // 更新设备基本信息
                        unit.status = result.is_online ? 'Active' : 'Offline';
                        unit.price = result.price;
                        unit.speed = result.speed;
                        unit.preCash = result.pre_cash;
                        unit.valid = result.valid === 1;
                        unit.validDate = result.valid_date;
                        unit.outlets = result.outlets || [];
                        unit.lastHeartbeat = new Date();

                        // 2. 获取设备状态（含传感器数据）
                        const statusInfo = await renrenWaterService.getDeviceStatus(unit.unitId);

                        if (statusInfo.success && statusInfo.code === 0) {
                            const statusResult = statusInfo.result;

                            // 更新传感器数据
                            unit.sensors = {
                                rawTDS: statusResult.raw_tds || 0,
                                pureTDS: statusResult.pure_tds || 0,
                                ph: 7.0,
                                temp: statusResult.temperature || 25,
                                humidity: statusResult.humidity || 50
                            };

                            // 更新状态标志
                            if (statusResult.miss_status === 1) unit.status = 'Maintenance';
                            if (statusResult.full_status === 1) unit.status = 'Maintenance';
                        }

                        await unit.save();

                        // 通过WebSocket推送更新
                        websocketService.sendDeviceUpdate(unit.unitId, {
                            unitId: unit.unitId,
                            status: unit.status,
                            sensors: unit.sensors,
                            price: unit.price,
                            speed: unit.speed,
                            outlets: unit.outlets,
                            lastHeartbeat: unit.lastHeartbeat
                        });

                        successCount++;
                    } else {
                        console.error(`[DataSync] API error for ${unit.unitId}:`, deviceInfo.error || deviceInfo);
                        failCount++;
                    }

                    // 延迟避免请求过快
                    await this.delay(100);
                } catch (error) {
                    console.error(`[DataSync] Error syncing ${unit.unitId}:`, error.message);
                    failCount++;
                }
            }

            console.log(`[DataSync] Device sync completed: ${successCount} success, ${failCount} failed`);

            // 发送系统通知
            if (failCount > 0) {
                websocketService.sendNotification('warning', `设备同步完成: ${successCount}成功, ${failCount}失败`);
            }

        } catch (error) {
            console.error('[DataSync] Error in syncAllDevices:', error.message);
        }
    }

    /**
     * 同步所有卡片数据
     */
    async syncAllCards() {
        try {
            console.log('[DataSync] Syncing all cards...');

            // 获取所有已知的卡片号
            const cards = await RenrenCard.find({});
            let successCount = 0;
            let failCount = 0;

            for (const card of cards) {
                try {
                    // 判断是实体卡还是电子卡
                    // 电子卡：11位数字；实体卡：1字母+8数字
                    const isEcard = /^[0-9]{11}$/.test(card.cardNo);

                    let cardInfo;
                    if (isEcard) {
                        // 电子卡使用电子卡接口
                        cardInfo = await renrenWaterService.getEcardInfo(card.cardNo);
                    } else {
                        // 实体卡使用实体卡接口
                        cardInfo = await renrenWaterService.getCardInfo(card.cardNo);
                    }

                    if (cardInfo.success && cardInfo.code === 0) {
                        const result = cardInfo.result;

                        // 保存旧余额用于比较
                        const oldBalance = card.balance;

                        // 更新卡片信息
                        card.balance = result.balance || 0;
                        card.realBalance = result.real_balance || result.balance || 0;
                        card.presentCash = result.present_cash || 0;
                        card.valid = result.valid || 1;
                        card.isBlack = result.is_black === 1;
                        card.operatorName = result.operator_name || '';
                        card.userPhone = result.user_phone || '';
                        card.userName = result.user_name || card.userName;
                        card.remark = result.remark || '';
                        card.groupId = result.group_id || '';
                        card.unsyncCash = result.unsync_cash || 0;

                        if (result.create_time) {
                            card.createTime = new Date(result.create_time);
                        }
                        if (result.update_time) {
                            card.updateTime = new Date(result.update_time);
                        }
                        card.lastSyncTime = new Date();

                        await card.save();
                        successCount++;

                        // 如果余额发生变化，通过WebSocket推送更新
                        if (oldBalance !== card.balance) {
                            console.log(`[DataSync] Card ${card.cardNo} balance changed: ${oldBalance} -> ${card.balance}`);
                            websocketService.sendCardUpdate(card.cardNo, {
                                cardNo: card.cardNo,
                                balance: card.balance,
                                realBalance: card.realBalance,
                                presentCash: card.presentCash,
                                unsyncCash: card.unsyncCash,
                                valid: card.valid,
                                lastSyncTime: card.lastSyncTime
                            });
                        }
                    } else {
                        failCount++;
                    }

                    await this.delay(50);
                } catch (error) {
                    console.error(`[DataSync] Error syncing card ${card.cardNo}:`, error.message);
                    failCount++;
                }
            }

            console.log(`[DataSync] Card sync completed: ${successCount} success, ${failCount} failed`);

        } catch (error) {
            console.error('[DataSync] Error in syncAllCards:', error.message);
        }
    }

    /**
     * 同步用户的电子卡（高频同步）
     * 只同步有用户绑定的电子卡
     */
    async syncUserEcards() {
        try {
            console.log('[DataSync] Syncing user e-cards (high frequency)...');

            // 只获取有用户绑定的电子卡（11位数字）
            const cards = await RenrenCard.find({
                localUserId: { $exists: true, $ne: null },
                cardNo: /^[0-9]{11}$/  // 电子卡格式
            });

            let successCount = 0;
            let failCount = 0;

            for (const card of cards) {
                try {
                    const cardInfo = await renrenWaterService.getEcardInfo(card.cardNo);

                    if (cardInfo.success && cardInfo.code === 0) {
                        const result = cardInfo.result;
                        const oldBalance = card.balance;

                        // 更新卡片信息
                        card.balance = result.balance || 0;
                        card.realBalance = result.balance || 0;
                        card.presentCash = result.present_cash || 0;
                        card.deviceNo = result.device_no || card.deviceNo;
                        card.operatorName = result.operator_name || '';
                        card.userName = result.user_name || card.userName;
                        card.remark = result.remark || '';
                        card.groupId = result.group_id || '';
                        card.lastSyncTime = new Date();

                        if (result.update_time) {
                            card.updateTime = new Date(result.update_time);
                        }

                        await card.save();
                        successCount++;

                        // 余额变化时推送
                        if (oldBalance !== card.balance) {
                            console.log(`[DataSync] E-card ${card.cardNo} balance changed: ${oldBalance} -> ${card.balance}`);
                            websocketService.sendCardUpdate(card.cardNo, {
                                cardNo: card.cardNo,
                                balance: card.balance,
                                realBalance: card.realBalance,
                                presentCash: card.presentCash,
                                deviceNo: card.deviceNo,
                                valid: card.valid,
                                lastSyncTime: card.lastSyncTime,
                                userId: card.localUserId?.toString()
                            });
                        }
                    } else {
                        failCount++;
                    }

                    await this.delay(100);
                } catch (error) {
                    console.error(`[DataSync] Error syncing e-card ${card.cardNo}:`, error.message);
                    failCount++;
                }
            }

            console.log(`[DataSync] E-card sync completed: ${successCount} success, ${failCount} failed`);

        } catch (error) {
            console.error('[DataSync] Error in syncUserEcards:', error.message);
        }
    }

    /**
     * 同步所有交易记录
     */
    async syncAllTransactions() {
        try {
            console.log('[DataSync] Syncing all transaction records...');

            // 遍历所有卡片，获取交易记录
            const cards = await RenrenCard.find({ valid: 1 });
            let totalCount = 0;

            for (const card of cards) {
                try {
                    // 获取第一页交易记录
                    const records = await renrenWaterService.getCardRecords(card.cardNo, 1, 20);

                    if (records.success && records.code === 0) {
                        const result = records.result;

                        if (result.list && Array.isArray(result.list)) {
                            for (const record of result.list) {
                                // 检查是否已存在
                                const exists = await RenrenTransaction.findOne({ outTradeNo: record.out_trade_no || record.cardNo + '_' + record.createTime });

                                if (!exists) {
                                    await RenrenTransaction.create({
                                        outTradeNo: record.out_trade_no || card.cardNo + '_' + record.createTime,
                                        cardNo: record.cardNo,
                                        cash: record.cash || 0,
                                        days: record.days || 0,
                                        presentCash: record.present_cash || 0,
                                        tradePayType: record.tradePayType || 3,
                                        syncStatus: record.sync_status || 1,
                                        createTime: record.createTime ? new Date(record.createTime) : new Date(),
                                        syncTime: record.syncTime ? new Date(record.syncTime) : new Date(),
                                        successTime: record.successTime ? new Date(record.successTime) : new Date(),
                                        remark: record.remark || ''
                                    });

                                    totalCount++;
                                }
                            }
                        }
                    }

                    await this.delay(50);
                } catch (error) {
                    console.error(`[DataSync] Error syncing transactions for card ${card.cardNo}:`, error.message);
                }
            }

            console.log(`[DataSync] Transaction sync completed: ${totalCount} new records`);

        } catch (error) {
            console.error('[DataSync] Error in syncAllTransactions:', error.message);
        }
    }

    /**
     * 同步所有滤芯数据
     */
    async syncAllFilters() {
        try {
            console.log('[DataSync] Syncing all filter data...');

            const units = await Unit.find({});

            for (const unit of units) {
                try {
                    const filters = await renrenWaterService.getDeviceFilters(unit.unitId);

                    if (filters.success && filters.code === 0) {
                        const result = filters.result;

                        // 保存滤芯数据
                        unit.filters = result.filters || [];
                        unit.filterUpdateTime = new Date();

                        await unit.save();

                        // 发送通知
                        if (result.filters && result.filters.length > 0) {
                            const needReplacement = result.filters.filter(f => f.used_rate > 8000);
                            if (needReplacement.length > 0) {
                                websocketService.sendNotification(
                                    'warning',
                                    `${unit.unitId} 需要${needReplacement.length}个滤芯更换`
                                );
                            }
                        }
                    }

                    await this.delay(100);
                } catch (error) {
                    console.error(`[DataSync] Error syncing filters for ${unit.unitId}:`, error.message);
                }
            }

            console.log('[DataSync] Filter sync completed');

        } catch (error) {
            console.error('[DataSync] Error in syncAllFilters:', error.message);
        }
    }

    /**
     * 同步单个设备
     */
    async syncSingleDevice(deviceId) {
        try {
            const unit = await Unit.findOne({ unitId: deviceId });
            if (!unit) {
                console.error(`[DataSync] Device ${deviceId} not found`);
                return null;
            }

            // 获取设备信息
            const deviceInfo = await renrenWaterService.getDeviceInfo(deviceId);

            if (deviceInfo.success && deviceInfo.code === 0) {
                const result = deviceInfo.result;

                unit.status = result.is_online ? 'Active' : 'Offline';
                unit.price = result.price;
                unit.speed = result.speed;
                unit.outlets = result.outlets || [];
                unit.lastHeartbeat = new Date();

                // 获取设备状态
                const statusInfo = await renrenWaterService.getDeviceStatus(deviceId);

                if (statusInfo.success && statusInfo.code === 0) {
                    const statusResult = statusInfo.result;

                    unit.sensors = {
                        rawTDS: statusResult.raw_tds || 0,
                        pureTDS: statusResult.pure_tds || 0,
                        temp: statusResult.temperature || 25,
                        humidity: statusResult.humidity || 50
                    };
                }

                await unit.save();

                // WebSocket推送
                websocketService.sendDeviceUpdate(deviceId, {
                    unitId: deviceId,
                    status: unit.status,
                    sensors: unit.sensors,
                    price: unit.price,
                    speed: unit.speed,
                    outlets: unit.outlets,
                    lastHeartbeat: unit.lastHeartbeat
                });

                console.log(`[DataSync] Device ${deviceId} synced successfully`);
                return unit;
            }

            return null;
        } catch (error) {
            console.error(`[DataSync] Error syncing ${deviceId}:`, error.message);
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
            syncs: {
                devices: !!this.syncIntervals.devices,
                cards: !!this.syncIntervals.cards,
                transactions: !!this.syncIntervals.transactions,
                filters: !!this.syncIntervals.filters
            }
        };
    }
}

module.exports = new CompleteDataSyncService();
