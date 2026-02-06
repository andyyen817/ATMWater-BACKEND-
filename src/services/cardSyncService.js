const RenrenCard = require('../models/RenrenCard');
const renrenWaterService = require('./renrenWaterService');
// Simple logger functions
const logInfo = (msg, data) => console.log(`[INFO] ${msg}`, data);
const logError = (msg, data) => console.error(`[ERROR] ${msg}`, data);

/**
 * 卡片充值与同步服务
 * 管理实体卡与人人水站的数据同步流程
 */
class CardSyncService {
    /**
     * 执行完整的卡充值和数据同步流程
     * 
     * 流程:
     * 1. 验证卡片存在性
     * 2. 调用人人水站充值接口
     * 3. 等待处理完毕
     * 4. 同步最新卡片数据
     * 5. 更新本地数据库
     * 
     * @param {Object} params 参数对象
     * @param {String} params.cardNo 卡号
     * @param {String} params.outTradeNo 交易号
     * @param {Number} params.cash 充值金额(单位:分)
     * @param {Number} params.presentCash 赠送金额(单位:分)
     * @param {Number} params.days 有效期(天)
     * @param {String} params.remark 备注
     * @param {String} params.userId 用户ID
     * @returns {Promise<Object>} 充值结果
     */
    async chargeAndSync(params) {
        const {
            cardNo,
            outTradeNo,
            cash = 0,
            presentCash = 0,
            days = 0,
            remark = '',
            userId
        } = params;

        logInfo('[CardSync] 开始充值流程', {
            cardNo,
            outTradeNo,
            cash,
            presentCash,
            userId
        });

        try {
            // 1. 验证卡片存在且属于该用户
            const card = await this.verifyCardOwnership(cardNo, userId);

            // 2. 调用人人水站充值接口
            logInfo('[CardSync] 调用人人水站充值接口', {
                cardNo,
                cash,
                presentCash,
                days
            });

            const chargeResult = await renrenWaterService.chargeCard(
                outTradeNo,
                cardNo,
                cash,
                presentCash,
                days,
                remark
            );

            if (!chargeResult.success || chargeResult.code !== 0) {
                logError('[CardSync] 人人水站充值失败', {
                    cardNo,
                    error: chargeResult.error,
                    code: chargeResult.code
                });

                throw new Error(`充值失败: ${chargeResult.error || '未知错误'}`);
            }

            logInfo('[CardSync] 人人水站充值成功', {
                cardNo,
                realBalance: chargeResult.result.real_balance
            });

            // 3. 等待1秒让人人水站处理完毕
            // (人人水站需要时间更新卡片信息到云端)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 4. 从人人水站同步最新卡片信息
            logInfo('[CardSync] 同步最新卡片信息', { cardNo });

            const syncResult = await renrenWaterService.getCardInfo(cardNo);

            if (!syncResult.success || syncResult.code !== 0) {
                logError('[CardSync] 同步卡片信息失败', {
                    cardNo,
                    error: syncResult.error,
                    code: syncResult.code
                });

                // 即使同步失败也返回充值成功，因为充值已经在人人水站完成
                return {
                    success: true,
                    message: '充值成功，但数据同步有延迟',
                    data: {
                        cardNo: card.cardNo,
                        balance: card.balance,
                        realBalance: card.realBalance,
                        unsyncCash: card.unsyncCash,
                        presentCash: card.presentCash,
                        lastSyncTime: card.lastSyncTime,
                        syncError: true
                    }
                };
            }

            const updatedCardInfo = syncResult.result;

            logInfo('[CardSync] 收到最新卡片信息', {
                cardNo,
                balance: updatedCardInfo.balance,
                realBalance: updatedCardInfo.real_balance,
                unsyncCash: updatedCardInfo.unsync_cash
            });

            // 5. 更新本地MongoDB中的卡片记录
            card.balance = updatedCardInfo.balance;
            card.realBalance = updatedCardInfo.real_balance;
            card.presentCash = updatedCardInfo.present_cash || 0;
            card.valid = updatedCardInfo.valid;
            card.isBlack = updatedCardInfo.is_black === 1;
            card.operatorName = updatedCardInfo.operator_name || '';
            card.userPhone = updatedCardInfo.user_phone || '';
            card.userName = updatedCardInfo.user_name || '';
            card.remark = updatedCardInfo.remark || '';
            card.groupId = updatedCardInfo.group_id || '';
            
            // 处理未同步金额
            const unsyncCash = updatedCardInfo.unsync_cash || 0;
            card.unsyncCash = unsyncCash;

            if (updatedCardInfo.update_time) {
                card.updateTime = new Date(updatedCardInfo.update_time);
            }
            card.lastSyncTime = new Date();

            await card.save();

            logInfo('[CardSync] 本地数据库已更新', {
                cardNo,
                newBalance: card.balance,
                newRealBalance: card.realBalance,
                newUnsyncCash: card.unsyncCash
            });

            // 6. 返回充值结果
            return {
                success: true,
                message: '充值成功',
                data: {
                    cardNo: card.cardNo,
                    balance: card.balance,
                    realBalance: card.realBalance,
                    unsyncCash: card.unsyncCash,
                    presentCash: card.presentCash,
                    valid: card.valid,
                    isBlack: card.isBlack,
                    lastSyncTime: card.lastSyncTime,
                    chargeAmount: cash + presentCash,
                    note: unsyncCash > 0 ? '有待同步金额，需在水站设备刷卡同步' : undefined
                }
            };
        } catch (error) {
            logError('[CardSync] 充值流程异常', {
                cardNo,
                error: error.message,
                stack: error.stack
            });

            throw error;
        }
    }

    /**
     * 验证卡片所有权
     * @param {String} cardNo 卡号
     * @param {String} userId 用户ID
     * @returns {Promise<Object>} 卡片对象
     */
    async verifyCardOwnership(cardNo, userId) {
        const card = await RenrenCard.findOne({ cardNo });

        if (!card) {
            throw new Error(`卡片不存在: ${cardNo}`);
        }

        if (!card.localUserId || card.localUserId.toString() !== userId.toString()) {
            throw new Error('您没有操作此卡的权限');
        }

        if (card.valid !== 1) {
            throw new Error(`卡片状态异常(${this.getValidStatusText(card.valid)})，无法充值`);
        }

        if (card.isBlack) {
            throw new Error('该卡已被设置为黑名单，无法使用');
        }

        return card;
    }

    /**
     * 获取卡片有效状态文本
     * @param {Number} valid 有效状态码
     * @returns {String} 状态文本
     */
    getValidStatusText(valid) {
        const statusMap = {
            1: '正常',
            2: '已冻结',
            3: '已过期',
            5: '已注销'
        };
        return statusMap[valid] || '未知状态';
    }

    /**
     * 同步单张卡片的最新信息(不充值)
     * 用于定期更新卡片余额、待同步金额等
     * 
     * @param {String} cardNo 卡号
     * @param {String} userId 用户ID
     * @returns {Promise<Object>} 同步结果
     */
    async syncCardInfo(cardNo, userId) {
        logInfo('[CardSync] 开始同步卡片信息', { cardNo, userId });

        try {
            // 验证卡片所有权
            const card = await this.verifyCardOwnership(cardNo, userId);

            // 从人人水站获取最新信息
            const syncResult = await renrenWaterService.getCardInfo(cardNo);

            if (!syncResult.success || syncResult.code !== 0) {
                logError('[CardSync] 同步失败', {
                    cardNo,
                    error: syncResult.error
                });

                return {
                    success: false,
                    message: '同步失败',
                    error: syncResult.error
                };
            }

            const cardInfo = syncResult.result;

            // 更新本地数据
            card.balance = cardInfo.balance;
            card.realBalance = cardInfo.real_balance;
            card.presentCash = cardInfo.present_cash || 0;
            card.unsyncCash = cardInfo.unsync_cash || 0;
            card.valid = cardInfo.valid;
            card.isBlack = cardInfo.is_black === 1;
            card.userName = cardInfo.user_name || card.userName;
            card.userPhone = cardInfo.user_phone || card.userPhone;
            card.remark = cardInfo.remark || '';
            card.lastSyncTime = new Date();

            if (cardInfo.update_time) {
                card.updateTime = new Date(cardInfo.update_time);
            }

            await card.save();

            logInfo('[CardSync] 同步完成', {
                cardNo,
                balance: card.balance,
                unsyncCash: card.unsyncCash
            });

            return {
                success: true,
                message: '同步成功',
                data: {
                    cardNo: card.cardNo,
                    balance: card.balance,
                    realBalance: card.realBalance,
                    unsyncCash: card.unsyncCash,
                    presentCash: card.presentCash,
                    valid: card.valid,
                    lastSyncTime: card.lastSyncTime
                }
            };
        } catch (error) {
            logError('[CardSync] 同步异常', {
                cardNo,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * 批量同步用户的所有卡片
     * @param {String} userId 用户ID
     * @returns {Promise<Array>} 同步结果数组
     */
    async syncUserCards(userId) {
        logInfo('[CardSync] 批量同步用户卡片', { userId });

        try {
            const cards = await RenrenCard.find({ localUserId: userId });

            const results = await Promise.all(
                cards.map(card =>
                    this.syncCardInfo(card.cardNo, userId)
                        .catch(err => ({
                            success: false,
                            cardNo: card.cardNo,
                            error: err.message
                        }))
                )
            );

            const successCount = results.filter(r => r.success).length;
            logInfo('[CardSync] 批量同步完成', {
                userId,
                total: cards.length,
                success: successCount
            });

            return results;
        } catch (error) {
            logError('[CardSync] 批量同步异常', {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * 获取卡片是否有待同步金额
     * @param {String} cardNo 卡号
     * @returns {Promise<Object>}
     */
    async checkUnsyncCash(cardNo) {
        const card = await RenrenCard.findOne({ cardNo });

        if (!card) {
            throw new Error(`卡片不存在: ${cardNo}`);
        }

        return {
            cardNo: card.cardNo,
            unsyncCash: card.unsyncCash,
            lastSyncTime: card.lastSyncTime,
            needsSync: card.unsyncCash > 0,
            message: card.unsyncCash > 0
                ? `有${card.unsyncCash / 100}元待同步，需在水站设备刷卡同步`
                : '没有待同步金额'
        };
    }
}

module.exports = new CardSyncService();




