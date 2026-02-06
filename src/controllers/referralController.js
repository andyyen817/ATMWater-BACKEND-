const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * @desc    获取用户的推荐数据 (推荐码、已邀请人数、总奖励)
 * @route   GET /api/referral/stats
 */
exports.getReferralStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('referralCode');

        // 1. 查找我邀请的人
        const invitees = await User.find({ managedBy: userId }).select('phoneNumber createdAt isFirstTopUpDone');
        
        // 2. 统计已发放的奖励金额
        const rewards = await Transaction.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    type: 'ReferralReward',
                    status: 'Completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const totalEarned = rewards.length > 0 ? rewards[0].total : 0;

        res.status(200).json({
            success: true,
            data: {
                referralCode: user.referralCode,
                inviteCount: invitees.length,
                totalFriends: invitees.length, // Alias for app compatibility
                successCount: invitees.filter(i => i.isFirstTopUpDone).length,
                totalEarned,
                totalLiters: totalEarned, // Assuming reward is in Liters or equivalent
                invitees
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
