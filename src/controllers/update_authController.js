const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const messageService = require('../services/messageService');

// 生成 6 位大写推荐码
const generateReferralCode = () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
};

/**
 * @desc    设置或重置密码
 * @route   POST /api/auth/set-password
 */
exports.setPassword = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await User.findByIdAndUpdate(req.user.id, { password: hashedPassword });

        res.status(200).json({ success: true, message: 'Password set successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    密码登录
 * @route   POST /api/auth/login-password
 */
exports.loginWithPassword = async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;
        const user = await User.findOne({ phoneNumber }).select('+password');

        if (!user || !user.password) {
            return res.status(401).json({ success: false, message: 'Invalid credentials or password not set' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(200).json({
            success: true,
            token,
            user: { id: user._id, phoneNumber: user.phoneNumber, role: user.role, name: user.name }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    请求发送 OTP
exports.requestOTP = async (req, res) => {
    console.log('--- OTP REQUEST RECEIVED ---', req.body);
    try {
        const { phoneNumber, referrerCode } = req.body; // 注册时可选传入推荐码

        if (!phoneNumber) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

        let user = await User.findOne({ phoneNumber });
        
        if (!user) {
            // 新用户注册
            user = new User({ 
                phoneNumber, 
                referralCode: generateReferralCode() 
            });

            // 处理推荐关系
            if (referrerCode) {
                const referrer = await User.findOne({ referralCode: referrerCode.toUpperCase() });
                if (referrer) {
                    user.managedBy = referrer._id;
                    console.log(`[Referral] New user ${phoneNumber} referred by ${referrer.phoneNumber}`);
                }
            }
            await user.save();
        }

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // 4. 发送 OTP (通过通用消息服务)
        await messageService.sendOTP(phoneNumber, otp);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            // 生产环境下建议通过环境变量决定是否返回 debug_otp
            debug_otp: process.env.NODE_ENV === 'production' ? undefined : otp 
        });

    } catch (error) {
        console.error('OTP Request Error:', error.message);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
};

// @desc    验证 OTP 并登录
// @route   POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({ message: 'Phone number and OTP are required' });
        }

        // 1. 查找用户
        const user = await User.findOne({ phoneNumber });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 2. 验证 OTP 是否匹配且未过期
        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // 3. 验证成功，清除 OTP 并更新最后登录时间
        user.otp = undefined;
        user.otpExpires = undefined;
        user.lastLogin = Date.now();
        await user.save();

        // 4. 生成 JWT Token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                phoneNumber: user.phoneNumber,
                role: user.role,
                name: user.name,
                balance: user.balance
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
