/**
 * 绑定卡片到用户脚本
 * 用法: node bind_card_to_user.js <卡号> <手机号>
 * 示例: node bind_card_to_user.js B60590417 8888
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const RenrenCard = require('./src/models/RenrenCard');
const renrenWaterService = require('./src/services/renrenWaterService');

// 数据库连接
async function connectDB() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error('错误: MONGODB_URI 环境变量未设置');
        process.exit(1);
    }

    console.log('正在连接数据库...');
    console.log('URI:', uri.replace(/:([^:@]+)@/, ':****@'));

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000, // 增加超时到15秒
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,
        });
        console.log('数据库连接成功!');
        return true;
    } catch (error) {
        console.error('数据库连接失败:', error.message);
        console.log('');
        console.log('可能的原因:');
        console.log('1. 网络连接问题 (可能需要 VPN)');
        console.log('2. MongoDB Atlas IP 白名单未配置');
        console.log('3. 数据库凭据错误');
        console.log('4. 防火墙阻止了连接');
        return false;
    }
}

async function bindCardToUser() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('用法: node bind_card_to_user.js <卡号> <手机号>');
        console.log('示例: node bind_card_to_user.js B60590417 8888');
        process.exit(1);
    }

    const cardNo = args[0];
    const phoneNumber = args[1];

    console.log('========================================');
    console.log('绑定卡片到用户');
    console.log('========================================');
    console.log('卡号:', cardNo);
    console.log('手机号:', phoneNumber);
    console.log('----------------------------------------');

    // 连接数据库
    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    try {
        // 1. 查找用户
        console.log('\n[1/4] 查找用户...');
        const user = await User.findOne({ phoneNumber });

        if (!user) {
            console.error('错误: 用户不存在!');
            console.log('请先创建该手机号的用户账户');
            process.exit(1);
        }

        console.log('找到用户:');
        console.log('  - ID:', user._id);
        console.log('  - 手机号:', user.phoneNumber);
        console.log('  - 名称:', user.name);
        console.log('  - 角色:', user.role);

        // 2. 从人人水站同步卡片信息
        console.log('\n[2/4] 从人人水站同步卡片信息...');
        const cardInfo = await renrenWaterService.getCardInfo(cardNo);

        if (!cardInfo.success || cardInfo.code !== 0) {
            console.error('错误: 无法从人人水站获取卡片信息!');
            console.log('响应:', cardInfo);
            process.exit(1);
        }

        console.log('人人水站卡片信息:');
        console.log('  - 卡号:', cardInfo.result.card_no);
        console.log('  - 余额:', cardInfo.result.balance);
        console.log('  - 真实余额:', cardInfo.result.real_balance);
        console.log('  - 赠送金额:', cardInfo.result.present_cash);
        console.log('  - 状态:', cardInfo.result.valid === 1 ? '正常' : '异常');
        console.log('  - 手机号:', cardInfo.result.user_phone || '(未设置)');
        console.log('  - 姓名:', cardInfo.result.user_name || '(未设置)');

        // 3. 查找或创建本地卡片记录
        console.log('\n[3/4] 更新本地卡片记录...');
        let card = await RenrenCard.findOne({ cardNo });

        if (!card) {
            console.log('本地不存在该卡片，创建新记录...');
            card = new RenrenCard({
                cardNo: cardInfo.result.card_no || cardNo,
                balance: cardInfo.result.balance,
                realBalance: cardInfo.result.real_balance,
                presentCash: cardInfo.result.present_cash || 0,
                valid: cardInfo.result.valid,
                isBlack: cardInfo.result.is_black === 1,
                operatorName: cardInfo.result.operator_name || '',
                userPhone: cardInfo.result.user_phone || '',
                userName: cardInfo.result.user_name || '',
                remark: cardInfo.result.remark || '',
                groupId: cardInfo.result.group_id || '',
                unsyncCash: cardInfo.result.unsync_cash || 0,
                createTime: cardInfo.result.create_time ? new Date(cardInfo.result.create_time) : new Date(),
                updateTime: cardInfo.result.update_time ? new Date(cardInfo.result.update_time) : new Date()
            });
        } else {
            console.log('本地已存在该卡片，更新信息...');
            card.balance = cardInfo.result.balance;
            card.realBalance = cardInfo.result.real_balance;
            card.presentCash = cardInfo.result.present_cash || 0;
            card.valid = cardInfo.result.valid;
            card.isBlack = cardInfo.result.is_black === 1;
            card.userPhone = cardInfo.result.user_phone || '';
            card.userName = cardInfo.result.user_name || '';
            card.lastSyncTime = new Date();
        }

        // 4. 绑定用户
        console.log('\n[4/4] 绑定用户到卡片...');
        const previousUserId = card.localUserId;
        card.localUserId = user._id;

        await card.save();

        console.log('绑定成功!');
        console.log('----------------------------------------');
        console.log('卡片信息:');
        console.log('  - 卡号:', card.cardNo);
        console.log('  - 余额:', card.balance);
        console.log('  - 绑定用户ID:', card.localUserId);
        console.log('  - 绑定用户手机:', user.phoneNumber);
        console.log('  - 绑定用户名称:', user.name);

        if (previousUserId) {
            console.log('\n注意: 该卡片之前已绑定到其他用户 (ID:', previousUserId, ')');
        }

        console.log('\n========================================');
        console.log('完成! 卡片已成功绑定到用户');
        console.log('========================================');

        process.exit(0);

    } catch (error) {
        console.error('\n发生错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 运行
bindCardToUser();
