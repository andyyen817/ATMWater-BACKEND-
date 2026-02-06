const Setting = require('../models/Setting');
const Ledger = require('../models/Ledger');
const User = require('../models/User');
const Unit = require('../models/Unit');
const Transaction = require('../models/Transaction');

/**
 * 4 角色自动分润引擎核心函数
 * @param {string} outTradeNo - 外部订单号 (out_trade_no) 或 Transaction ObjectId
 * @param {number} totalAmount - 该笔订单的总消费金额 (Rp)
 * @param {string} unitId - 水站设备 ID (用于查找 RP 和 Steward)
 * @param {string} customerId - 消费者 ID (用于查找其推荐人)
 */
const processProfitSharing = async (outTradeNo, totalAmount, unitId, customerId) => {
    try {
        console.log(`[Sharing Engine] Starting split for order ${outTradeNo} - Total: Rp ${totalAmount}`);

        // [FIX] Find the actual Transaction document to get its ObjectId for Ledger
        const transaction = await Transaction.findOne({ externalId: outTradeNo });
        if (!transaction) {
            console.warn(`[Sharing Engine] Transaction not found for ${outTradeNo}, creating new one...`);
            // For physical card orders without prior transaction, create one
            const newTransaction = await Transaction.create({
                userId: customerId,
                type: 'WaterPurchase',
                amount: totalAmount,
                externalId: outTradeNo,
                status: 'Completed',
                description: `Physical Card Purchase at ${unitId}`
            });
            transaction = newTransaction;
        }

        // 1. 获取当前系统分润比例设置 (从水价设置中获取，因为它们现在合在了一起)
        let setting = await Setting.findOne({ key: 'water_pricing' });
        if (!setting) {
            // 如果没设置，尝试找旧的 key (兜底)
            setting = await Setting.findOne({ key: 'profit_sharing_ratios' });
        }

        if (!setting) {
            // 还是没有，则报错或使用硬编码默认值 (此处抛出异常由上层捕获)
            throw new Error('System settings (water_pricing) not found. Please run seedSettings.');
        }
        const { ratios } = setting;

        // 验证 4 角色分润比例总和为 100%
        const totalRatio = ratios.airkop + ratios.rp + ratios.steward + ratios.growthFund;
        if (totalRatio !== 100) {
            console.error(`[Sharing Engine] WARNING: Ratios sum to ${totalRatio}%, not 100%!`);
        }

        // 2. 查找相关的分润人 (MVP 阶段假设设备关联了 RP 和 Steward)
        // Unit 模型字段: rpOwner (RP), steward (Steward)
        const unit = await Unit.findOne({ unitId });

        // 3. 计算并分配 (4 角色: AirKOP, RP, Steward, GrowthFund)
        const participants = [
            { type: 'AirKOP', ratio: ratios.airkop, userId: null },
            { type: 'RP', ratio: ratios.rp, userId: unit ? unit.rpOwner : null },
            { type: 'Steward', ratio: ratios.steward, userId: unit ? unit.steward : null },
            { type: 'GrowthFund', ratio: ratios.growthFund, userId: null }
        ];

        const ledgerEntries = [];

        for (const p of participants) {
            const shareAmount = Math.floor(totalAmount * (p.ratio / 100));
            if (shareAmount <= 0) continue;

            // 写入分润账本 (Ledger) - 使用 Transaction 的 ObjectId
            ledgerEntries.push({
                transactionId: transaction._id, // 使用 ObjectId 而不是 out_trade_no
                userId: p.userId,
                accountType: p.type,
                amount: shareAmount,
                description: `Profit sharing from ${unitId} - ${p.ratio}%`
            });

            // 如果有具体的用户 ID (如 RP 或 Steward)，实时增加其账户余额
            if (p.userId) {
                await User.findByIdAndUpdate(p.userId, { $inc: { balance: shareAmount } });
                console.log(`[Sharing Engine] Credited Rp ${shareAmount} to ${p.type} (${p.userId})`);
            }
        }

        await Ledger.insertMany(ledgerEntries);
        console.log(`[Sharing Engine] Split completed. ${ledgerEntries.length} ledger entries created.`);

        return true;
    } catch (error) {
        console.error('[Sharing Engine] Fatal Error:', error);
        throw error;
    }
};

module.exports = {
    processProfitSharing
};

