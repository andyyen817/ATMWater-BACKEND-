const cron = require('node-cron');
const RenrenTransaction = require('../models/RenrenTransaction');
const renrenWaterService = require('./renrenWaterService');
const User = require('../models/User');

/**
 * 退款对账服务
 * 用于处理最大余额模式下未完成退款的交易
 */
const RefundReconciliationService = {
    // 配置
    CONFIG: {
        MAX_RETRY_ATTEMPTS: 3,        // 最大重试次数
        RETRY_DELAY_BASE: 5000,       // 基础重试延迟（毫秒）
        CHECK_INTERVAL_HOURS: 1,      // 检查间隔（小时）
        STALE_THRESHOLD_HOURS: 24     // 交易超过24小时未退款视为过期
    },

    /**
     * 核心任务：检查并处理未完成退款的交易
     */
    runReconciliationCheck: async () => {
        console.log(`[Refund Reconciliation] Starting check at ${new Date().toISOString()}`);

        try {
            // 查找需要处理的交易
            // 1. 最大余额模式且退款状态为 pending 或 processing
            // 2. 退款状态为 failed 且重试次数小于最大次数
            // 3. 交易时间在最近7天内（避免处理过旧交易）
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const pendingTransactions = await RenrenTransaction.find({
                isMaxBalanceMode: true,
                refundStatus: { $in: ['pending', 'processing', 'failed'] },
                refundRetryCount: { $lt: RefundReconciliationService.CONFIG.MAX_RETRY_ATTEMPTS },
                createdAt: { $gte: sevenDaysAgo }
            });

            console.log(`[Refund Reconciliation] Found ${pendingTransactions.length} transactions needing attention`);

            let successCount = 0;
            let failedCount = 0;
            let skippedCount = 0;

            for (const transaction of pendingTransactions) {
                const result = await RefundReconciliationService.processTransaction(transaction);

                if (result === 'success') {
                    successCount++;
                } else if (result === 'failed') {
                    failedCount++;
                } else {
                    skippedCount++;
                }
            }

            console.log(`[Refund Reconciliation] Check completed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);

            // 生成对账报告
            await RefundReconciliationService.generateReconciliationReport();

        } catch (error) {
            console.error('[Refund Reconciliation] Fatal check error:', error);
        }
    },

    /**
     * 处理单个交易的退款逻辑
     */
    processTransaction: async (transaction) => {
        const { outTradeNo, cardNo, maxBalanceAmount, actualAmount, refundStatus, refundRetryCount } = transaction;

        console.log(`[Refund Reconciliation] Processing ${outTradeNo}, status: ${refundStatus}, retries: ${refundRetryCount}`);

        // 检查是否需要退款
        const refundAmount = maxBalanceAmount - (actualAmount || 0);

        if (refundAmount <= 0) {
            console.log(`[Refund Reconciliation] No refund needed for ${outTradeNo}`);
            transaction.refundStatus = 'success';
            transaction.refundTime = new Date();
            await transaction.save();
            return 'skipped';
        }

        // 如果已经达到最大重试次数，标记为永久失败
        if (refundRetryCount >= RefundReconciliationService.CONFIG.MAX_RETRY_ATTEMPTS) {
            console.warn(`[Refund Reconciliation] ${outTradeNo} reached max retry attempts, marking as permanently failed`);
            transaction.refundStatus = 'failed';
            transaction.refundError = 'Max retry attempts reached';
            await transaction.save();
            return 'failed';
        }

        // 检查交易是否过期（超过24小时）
        const hoursSinceCreation = (Date.now() - transaction.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreation > RefundReconciliationService.CONFIG.STALE_THRESHOLD_HOURS) {
            console.warn(`[Refund Reconciliation] ${outTradeNo} is stale (${hoursSinceCreation.toFixed(1)}h old)`);
            // 过期交易仍然尝试退款，但需要更严格的检查
        }

        try {
            // 更新状态为处理中
            transaction.refundStatus = 'processing';
            await transaction.save();

            const refundOutTradeNo = `RECONCILE_${Date.now()}_${cardNo}`;

            // 调用退款API
            const refundResult = await renrenWaterService.chargeEcard(
                refundOutTradeNo,
                cardNo,
                refundAmount,
                0,
                0,
                `Reconciliation Refund for ${outTradeNo}`
            );

            if (refundResult.success && refundResult.code === 0) {
                console.log(`[Refund Reconciliation] Refund successful for ${outTradeNo}: ${refundAmount} cents`);

                // 更新交易状态
                transaction.refundStatus = 'success';
                transaction.refundTradeNo = refundResult.result?.trade_no || '';
                transaction.refundTime = new Date();
                transaction.refundRetryCount = refundRetryCount + 1;
                await transaction.save();

                // 同步余额
                await RefundReconciliationService.syncBalanceAfterRefund(transaction, cardNo);

                // 创建退款记录
                await RefundReconciliationService.createRefundRecord(
                    transaction,
                    refundOutTradeNo,
                    refundResult.result?.trade_no || '',
                    refundAmount
                );

                return 'success';
            } else {
                console.warn(`[Refund Reconciliation] Refund failed for ${outTradeNo}:`, refundResult);

                transaction.refundStatus = 'failed';
                transaction.refundError = refundResult.error || 'Unknown error';
                transaction.refundRetryCount = refundRetryCount + 1;
                await transaction.save();

                return 'failed';
            }

        } catch (error) {
            console.error(`[Refund Reconciliation] Exception processing ${outTradeNo}:`, error.message);

            transaction.refundStatus = 'failed';
            transaction.refundError = error.message;
            transaction.refundRetryCount = refundRetryCount + 1;
            await transaction.save();

            return 'failed';
        }
    },

    /**
     * 退款后同步余额
     */
    syncBalanceAfterRefund: async (transaction, cardNo) => {
        const MAX_SYNC_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
            try {
                const syncResult = await renrenWaterService.getEcardInfo(cardNo);

                if (syncResult.success && syncResult.code === 0) {
                    const newBalance = syncResult.result?.balance || 0;

                    // 更新交易记录
                    transaction.balanceAfterRefund = newBalance;
                    await transaction.save();

                    // 更新用户余额
                    const user = await User.findOne({
                        phoneNumber: {
                            $in: [cardNo, '+86' + cardNo.substring(1), '+62' + cardNo.substring(1)]
                        }
                    });

                    if (user) {
                        user.balance = newBalance;
                        await user.save();
                    }

                    console.log(`[Refund Reconciliation] Balance synced for ${cardNo}: ${newBalance}`);
                    return true;
                }
            } catch (error) {
                console.error(`[Refund Reconciliation] Balance sync attempt ${attempt} failed:`, error.message);
                if (attempt < MAX_SYNC_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        console.error(`[Refund Reconciliation] Balance sync failed after ${MAX_SYNC_RETRIES} attempts`);
        return false;
    },

    /**
     * 创建退款交易记录
     */
    createRefundRecord: async (parentTransaction, outTradeNo, tradeNo, refundAmount) => {
        try {
            await RenrenTransaction.create({
                outTradeNo: outTradeNo,
                tradeNo: tradeNo,
                deviceNo: parentTransaction.deviceNo,
                cardNo: parentTransaction.cardNo,
                waterTime: new Date(),
                waterState: 1,
                cash: -refundAmount,
                startBalance: parentTransaction.endBalance,
                endBalance: parentTransaction.balanceAfterRefund,
                outlet: parentTransaction.outlet,
                tradePayType: 5,
                syncStatus: 1,
                createTime: new Date(),
                syncTime: new Date(),

                isMaxBalanceMode: false,
                maxBalanceAmount: 0,
                actualAmount: refundAmount,
                refundAmount: refundAmount,
                parentTradeNo: parentTransaction.outTradeNo,

                refundStatus: 'success',
                refundRetryCount: 1,
                refundTradeNo: tradeNo,
                refundTime: new Date(),

                localUserId: parentTransaction.localUserId
            });

            console.log(`[Refund Reconciliation] Refund record created: ${outTradeNo}`);
        } catch (error) {
            console.error(`[Refund Reconciliation] Failed to create refund record:`, error.message);
        }
    },

    /**
     * 生成对账报告
     */
    generateReconciliationReport: async () => {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const stats = {
                total: 0,
                success: 0,
                pending: 0,
                processing: 0,
                failed: 0,
                totalRefundAmount: 0
            };

            const transactions = await RenrenTransaction.find({
                isMaxBalanceMode: true,
                createdAt: { $gte: today }
            });

            stats.total = transactions.length;

            for (const tx of transactions) {
                switch (tx.refundStatus) {
                    case 'success':
                        stats.success++;
                        break;
                    case 'pending':
                        stats.pending++;
                        break;
                    case 'processing':
                        stats.processing++;
                        break;
                    case 'failed':
                        stats.failed++;
                        break;
                }

                if (tx.refundStatus === 'success') {
                    stats.totalRefundAmount += tx.refundAmount || 0;
                }
            }

            console.log(`[Refund Reconciliation] Daily Report - Total: ${stats.total}, Success: ${stats.success}, Pending: ${stats.pending}, Processing: ${stats.processing}, Failed: ${stats.failed}, Total Refunded: Rp ${(stats.totalRefundAmount / 100).toFixed(2)}`);

        } catch (error) {
            console.error('[Refund Reconciliation] Report generation failed:', error.message);
        }
    },

    /**
     * 启动定时调度器（每小时运行一次）
     */
    initScheduler: () => {
        // 每小时的第0分钟运行
        cron.schedule('0 * * * *', () => {
            RefundReconciliationService.runReconciliationCheck();
        });
        console.log('✅ Refund Reconciliation Cron Job Scheduled: Every hour at :00');
    },

    /**
     * 手动触发对账（用于测试或紧急处理）
     */
    manualTrigger: async () => {
        console.log('[Refund Reconciliation] Manual trigger initiated');
        await RefundReconciliationService.runReconciliationCheck();
    }
};

module.exports = RefundReconciliationService;
