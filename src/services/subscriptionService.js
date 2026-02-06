const cron = require('node-cron');
const Unit = require('../models/Unit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * 订阅费自动扣除服务
 */
const SubscriptionService = {
    // 基础费用定义 (PRD)
    FEES: {
        SOFTWARE: 200000,        // 软件订阅费 Rp 200,000/月
        CONSUMABLES_BASE: 500000, // 标准耗材费 Rp 500,000/月
        CONSUMABLES_HIGH: 800000  // 高 TDS 耗材费 Rp 800,000/月 (TDS > 500)
    },

    /**
     * [P2-API-006] 根据水质计算动态耗材费
     */
    calculateDynamicFee: (unit) => {
        const rawTDS = unit.sensors.rawTDS || 0;
        if (rawTDS > 500) {
            console.log(`[Subscription] Unit ${unit.unitId} detected HIGH TDS (${rawTDS}). Applying high fee.`);
            return SubscriptionService.FEES.CONSUMABLES_HIGH;
        }
        return SubscriptionService.FEES.CONSUMABLES_BASE;
    },

    /**
     * 核心任务：检查并扣除所有设备的订阅费
     */
    runDailyCheck: async () => {
        console.log(`[Subscription Service] Starting Daily Check at ${new Date().toISOString()}`);
        
        try {
            const units = await Unit.find().populate('rpOwner');
            
            for (const unit of units) {
                await SubscriptionService.processUnitSubscription(unit);
            }
            
            console.log('[Subscription Service] Daily Check Completed.');
        } catch (error) {
            console.error('[Subscription Service] Fatal Check Error:', error);
        }
    },

    /**
     * 处理单个设备的扣费逻辑
     */
    processUnitSubscription: async (unit) => {
        const now = new Date();
        const lastPaid = unit.subscription.lastPaidAt || unit.createdAt;
        
        // 计算距离上次扣费过了多少天
        const diffTime = Math.abs(now - lastPaid);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // 如果超过 30 天，尝试扣费
        if (diffDays >= 30) {
            // [P2-API-006] 获取动态耗材费
            const consumablesFee = SubscriptionService.calculateDynamicFee(unit);
            const totalFee = SubscriptionService.FEES.SOFTWARE + consumablesFee;
            
            const rp = await User.findById(unit.rpOwner);

            if (rp && rp.balance >= totalFee) {
                // 1. 余额充足，执行扣费
                rp.balance -= totalFee;
                await rp.save();

                // 2. 记录交易流水，标注是否含有高水质附加费
                const isHighTds = consumablesFee === SubscriptionService.FEES.CONSUMABLES_HIGH;
                await Transaction.create({
                    userId: rp._id,
                    type: 'SubscriptionFee',
                    amount: totalFee,
                    status: 'Completed',
                    description: `Monthly Fee for Unit ${unit.unitId} (Software + ${isHighTds ? 'High-TDS Consumables' : 'Standard Consumables'})`
                });

                // 3. 更新设备订阅状态
                unit.subscription.lastPaidAt = now;
                unit.subscription.isOverdue = false;
                unit.subscription.overdueDays = 0;
                
                // 如果之前是锁定状态，尝试解锁 (需配合心跳逻辑)
                if (unit.status === 'Locked') {
                    unit.status = 'Active';
                }
                
                console.log(`[Subscription] Success: Deducted Rp ${totalFee} from RP ${rp.phoneNumber} for Unit ${unit.unitId}`);
            } else {
                // 4. 余额不足，标记逾期
                unit.subscription.isOverdue = true;
                unit.subscription.overdueDays = diffDays - 30;

                // PRD 规定：逾期 14 天自动锁机
                if (unit.subscription.overdueDays >= 14) {
                    unit.status = 'Locked';
                    console.log(`[Subscription] Warning: Unit ${unit.unitId} LOCKED due to 14+ days overdue.`);
                }
                
                console.warn(`[Subscription] Failed: RP ${rp ? rp.phoneNumber : 'Unknown'} has insufficient balance for Unit ${unit.unitId}`);
            }
            
            await unit.save();
        }
    },

    /**
     * 启动定时调度器 (每天凌晨 00:01 运行)
     */
    initScheduler: () => {
        cron.schedule('1 0 * * *', () => {
            SubscriptionService.runDailyCheck();
        });
        console.log('✅ Subscription Cron Job Scheduled: Daily at 00:01');
    }
};

module.exports = SubscriptionService;

