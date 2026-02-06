const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

/**
 * @desc    提交提现申请 (APP端)
 * @route   POST /api/withdrawals/request
 */
exports.requestWithdrawal = async (req, res) => {
    try {
        const { amount, bankDetails } = req.body;
        const user = await User.findById(req.user.id);

        if (user.balance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        if (amount < 100000) {
            return res.status(400).json({ success: false, message: 'Minimum withdrawal is Rp 100,000' });
        }

        const withdrawal = await Withdrawal.create({
            userId: req.user.id,
            amount,
            bankDetails,
            status: 'Pending'
        });

        // 冻结余额
        user.balance -= amount;
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            data: withdrawal
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取我的提现记录 (APP端)
 * @route   GET /api/withdrawals/history
 */
exports.getWithdrawalHistory = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ userId: req.user.id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: withdrawals
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取所有提现申请 (WEB端)
 * @route   GET /api/withdrawals/admin/list
 */
exports.getWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find()
            .populate('userId', 'name phoneNumber role')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: withdrawals
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    批准提现 (WEB端)
 */
exports.approveWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.id);
        if (!withdrawal || withdrawal.status !== 'Pending') {
            return res.status(404).json({ success: false, message: 'Pending withdrawal not found' });
        }

        withdrawal.status = 'Approved';
        withdrawal.processedAt = Date.now();
        withdrawal.processedBy = req.user.id;
        await withdrawal.save();

        res.status(200).json({ success: true, message: 'Withdrawal approved' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    拒绝提现 (WEB端)
 */
exports.rejectWithdrawal = async (req, res) => {
    try {
        const { reason } = req.body;
        const withdrawal = await Withdrawal.findById(req.params.id);
        if (!withdrawal || withdrawal.status !== 'Pending') {
            return res.status(404).json({ success: false, message: 'Pending withdrawal not found' });
        }

        withdrawal.status = 'Rejected';
        withdrawal.adminNotes = reason;
        withdrawal.processedAt = Date.now();
        withdrawal.processedBy = req.user.id;
        
        // 退还余额
        const user = await User.findById(withdrawal.userId);
        if (user) {
            user.balance += withdrawal.amount;
            await user.save();
        }

        await withdrawal.save();

        res.status(200).json({ success: true, message: 'Withdrawal rejected and balance refunded' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};