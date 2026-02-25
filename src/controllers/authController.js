const { User } = require('../models'); // Stage 1 修复：使用 Sequelize 模型
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const messageService = require('../services/messageService');

// 生成 6 位大写推荐码
const generateReferralCode = () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
};

// OTP 速率限制：同一号码 10 分钟内最多 3 次
const otpRateLimit = new Map(); // key: phoneNumber, value: { count, firstRequestAt }
const OTP_RATE_LIMIT_MAX = 3;
const OTP_RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes

function checkOtpRateLimit(phoneNumber) {
    const now = Date.now();
    const record = otpRateLimit.get(phoneNumber);
    if (!record || (now - record.firstRequestAt > OTP_RATE_LIMIT_WINDOW)) {
        otpRateLimit.set(phoneNumber, { count: 1, firstRequestAt: now });
        return true;
    }
    if (record.count >= OTP_RATE_LIMIT_MAX) {
        return false;
    }
    record.count++;
    return true;
}

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

        await User.update({ password: hashedPassword }, { where: { id: req.user.id } });

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
    console.log('--- PASSWORD LOGIN RECEIVED ---', req.body);
    try {
        const { phoneNumber, password } = req.body;

        // Normalize phone number: accept '81234567891', '081234567891', '+6281234567891'
        let normalizedPhone = phoneNumber ? phoneNumber.trim() : '';
        if (normalizedPhone.startsWith('+62')) {
            normalizedPhone = '0' + normalizedPhone.slice(3);
        } else if (normalizedPhone.startsWith('62') && normalizedPhone.length >= 11) {
            normalizedPhone = '0' + normalizedPhone.slice(2);
        } else if (!normalizedPhone.startsWith('0') && normalizedPhone.length >= 9) {
            normalizedPhone = '0' + normalizedPhone;
        }

        console.log('[Login] Looking for phone:', normalizedPhone);
        const user = await User.findOne({ where: { phoneNumber: normalizedPhone } });
        console.log('[Login] User found:', user ? 'YES' : 'NO');
        if (user) {
            console.log('[Login] Has password:', user.password ? 'YES' : 'NO');
        }

        if (!user || !user.password) {
            return res.status(401).json({ success: false, message: 'Invalid credentials or password not set' });
        }

        console.log('[Login] Comparing passwords...');
        console.log('[Login] Input password:', password);
        console.log('[Login] Stored hash (first 30 chars):', user.password.substring(0, 30));
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('[Login] Password match:', isMatch);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(200).json({
            success: true,
            token,
            user: { id: user.id, phoneNumber: user.phoneNumber, role: user.role, name: user.name }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    请求发送 WhatsApp OTP
exports.requestOTP = async (req, res) => {
    console.log('--- WHATSAPP OTP REQUEST RECEIVED ---', req.body);
    try {
        const { phoneNumber, referrerCode } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        // 速率限制检查
        if (!checkOtpRateLimit(phoneNumber)) {
            return res.status(429).json({
                success: false,
                message: 'Too many OTP requests. Please try again later.',
                retryAfter: 600
            });
        }

        // 生成 6 位 OTP（WhatsApp 模板标准）
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

        let user = await User.findOne({ where: { phoneNumber } });

        if (!user) {
            user = await User.create({
                phoneNumber,
                referralCode: generateReferralCode()
            });

            if (referrerCode) {
                const referrer = await User.findOne({ where: { referralCode: referrerCode.toUpperCase() } });
                if (referrer) {
                    user.managedBy = referrer.id;
                    console.log(`[Referral] New user ${phoneNumber} referred by ${referrer.phoneNumber}`);
                    await user.save();
                }
            }
        }

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // 发送 OTP (通过 WhatsApp 消息服务)
        await messageService.sendOTP(phoneNumber, otp);

        res.status(200).json({
            success: true,
            message: 'OTP sent via WhatsApp',
            channel: 'whatsapp',
            expiresIn: 300,
            debug_otp: process.env.NODE_ENV === 'production' ? undefined : otp
        });

    } catch (error) {
        console.error('WhatsApp OTP Request Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Failed to send WhatsApp OTP' });
    }
};

// @desc    验证 WhatsApp OTP 并登录
// @route   POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
        }

        const user = await User.findOne({ where: { phoneNumber } });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        user.otp = undefined;
        user.otpExpires = undefined;
        user.lastLoginAt = new Date();
        user.isVerified = true;
        await user.save();

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(200).json({
            success: true,
            message: 'WhatsApp OTP verified successfully',
            data: {
                token,
                refreshToken,
                user: {
                    id: user.id,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                    name: user.name,
                    balance: user.balance
                }
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    Email + Password 登录
 * @route   POST /api/auth/login-email
 */
exports.loginWithEmail = async (req, res) => {
    console.log('--- EMAIL LOGIN RECEIVED ---', req.body);
    try {
        const { email, password } = req.body;

        // 验证输入
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        console.log('[Email Login] Looking for email:', email);
        // 查找用户 (使用email字段)
        const user = await User.findOne({ where: { email } });
        console.log('[Email Login] User found:', user ? 'YES' : 'NO');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // 验证密码
        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: 'Password not set for this account. Please use OTP login.'
            });
        }

        console.log('[Email Login] Comparing passwords...');
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('[Email Login] Password match:', isPasswordValid);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // 检查账户状态
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive'
            });
        }

        // 更新最后登录时间
        user.lastLoginAt = new Date();
        await user.save();

        // 生成JWT token
        const token = jwt.sign(
            { id: user.id, phoneNumber: user.phoneNumber, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // 生成refresh token
        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        console.log('[Email Login] Login successful for user:', user.email);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                refreshToken,
                user: {
                    id: user.id,
                    phoneNumber: user.phoneNumber,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    balance: user.balance
                }
            }
        });
    } catch (error) {
        console.error('[loginWithEmail] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};
