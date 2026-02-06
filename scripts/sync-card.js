require('dotenv').config();
const mongoose = require('mongoose');
const renrenWaterService = require('../src/services/renrenWaterService');
const RenrenCard = require('../src/models/RenrenCard');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Molly:Molly78901@atmrefill.7t5xtjk.mongodb.net/ATMWater_Refill?appName=ATMRefill';

/**
 * 同步单张卡片到数据库
 */
async function syncCard(cardNo) {
    console.log(`开始同步卡片: ${cardNo}`);

    try {
        // 连接数据库
        console.log('连接数据库...');
        await mongoose.connect(MONGODB_URI);
        console.log('数据库连接成功');

        // 调用人人水站API获取卡片信息
        console.log(`调用人人水站 API 查询卡片 ${cardNo}...`);
        const cardInfo = await renrenWaterService.getCardInfo(cardNo);

        console.log('API 返回:', JSON.stringify(cardInfo, null, 2));

        if (cardInfo.success && cardInfo.code === 0) {
            const result = cardInfo.result;

            // 检查卡片是否已存在
            let card = await RenrenCard.findOne({ cardNo });

            if (!card) {
                console.log('创建新卡片记录...');
                // 创建新卡片记录
                card = new RenrenCard({
                    cardNo: result.card_no || cardNo,
                    balance: result.balance || 0,
                    realBalance: result.real_balance || 0,
                    presentCash: result.present_cash || 0,
                    validDays: result.valid_days || 0,
                    valid: result.valid || 1,
                    isBlack: result.is_black === 1,
                    userName: result.user_name || '',
                    userPhone: result.user_phone || '',
                    operatorName: result.operator_name || '',
                    groupId: result.group_id || '',
                    remark: result.remark || '',
                    unsyncCash: result.unsync_cash || 0,
                    boundEcardNo: result.bound_ecard_no || '',
                    createTime: result.create_time ? new Date(result.create_time * 1000) : new Date(),
                    updateTime: result.update_time ? new Date(result.update_time * 1000) : new Date(),
                    lastSyncTime: new Date()
                });
            } else {
                console.log('更新现有卡片记录...');
                // 更新现有卡片
                card.balance = result.balance || 0;
                card.realBalance = result.real_balance || 0;
                card.presentCash = result.present_cash || 0;
                card.validDays = result.valid_days || 0;
                card.valid = result.valid || 1;
                card.isBlack = result.is_black === 1;
                card.userName = result.user_name || '';
                card.userPhone = result.user_phone || '';
                card.operatorName = result.operator_name || '';
                card.groupId = result.group_id || '';
                card.remark = result.remark || '';
                card.unsyncCash = result.unsync_cash || 0;
                card.boundEcardNo = result.bound_ecard_no || '';
                if (result.update_time) {
                    card.updateTime = new Date(result.update_time * 1000);
                }
                card.lastSyncTime = new Date();
            }

            await card.save();
            console.log('✅ 卡片同步成功!');
            console.log('卡片信息:');
            console.log(`  卡号: ${card.cardNo}`);
            console.log(`  余额: ${card.balance} 元`);
            console.log(`  实际余额: ${card.realBalance} 元`);
            console.log(`  赠送金额: ${card.presentCash} 元`);
            console.log(`  有效天数: ${card.validDays}`);
            console.log(`  状态: ${card.valid === 1 ? '正常' : card.valid === 2 ? '冻结' : card.valid === 3 ? '过期' : '注销'}`);
            console.log(`  用户名: ${card.userName || '未设置'}`);
            console.log(`  手机号: ${card.userPhone || '未设置'}`);

            return card;
        } else {
            console.error('❌ API 返回错误:', cardInfo);
            return null;
        }

    } catch (error) {
        console.error('❌ 同步失败:', error.message);
        return null;
    } finally {
        await mongoose.connection.close();
        console.log('数据库连接已关闭');
    }
}

// 从命令行参数获取卡号
const cardNo = process.argv[2] || 'B60590417';

syncCard(cardNo).then(card => {
    if (!card) {
        process.exit(1);
    }
    process.exit(0);
}).catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
});
