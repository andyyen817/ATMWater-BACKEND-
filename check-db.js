const mongoose = require('mongoose');
const RenrenCard = require('./src/models/RenrenCard');

const MONGODB_URI = 'mongodb+srv://Molly:Molly78901@atmrefill.7t5xtjk.mongodb.net/ATMWater_Refill?appName=ATMRefill';

async function checkAndUnbind() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('已连接到数据库');

        // 查询绑定在 +868888 的实物卡
        const cards = await RenrenCard.find({
            $or: [
                { userPhone: '+868888' },
                { cardNo: '+868888' }
            ]
        });

        console.log('\n找到的卡片:');
        for (const card of cards) {
            console.log(`- 卡号: ${card.cardNo}, 用户手机: ${card.userPhone}, localUserId: ${card.localUserId}`);
            if (card.boundPhysicalCards && card.boundPhysicalCards.length > 0) {
                console.log(`  绑定的实物卡: ${card.boundPhysicalCards.map(c => c.cardNo).join(', ')}`);
            }
        }

        // 查找电子卡（cardNo是手机号格式的）
        const electronicCard = await RenrenCard.findOne({ cardNo: '+868888' });
        if (electronicCard && electronicCard.boundPhysicalCards && electronicCard.boundPhysicalCards.length > 0) {
            console.log(`\n电子卡 +868888 绑定的实物卡:`);
            for (const bound of electronicCard.boundPhysicalCards) {
                console.log(`  - ${bound.cardNo} (${bound.nickname || '无昵称'})`);
            }

            // 解绑所有实物卡
            console.log('\n开始解绑...');
            electronicCard.boundPhysicalCards = [];
            await electronicCard.save();
            console.log('已解绑所有实物卡');
        }

        // 查找有 localUserId 的实物卡
        const boundPhysicalCards = await RenrenCard.find({ localUserId: { $exists: true } });
        console.log(`\n共有 ${boundPhysicalCards.length} 张卡片绑定了用户`);

        await mongoose.connection.close();
        console.log('\n完成');
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

checkAndUnbind();
