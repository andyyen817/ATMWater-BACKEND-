const mongoose = require('mongoose');
const RenrenCard = require('./src/models/RenrenCard');

const MONGODB_URI = 'mongodb+srv://Molly:Molly78901@atmrefill.7t5xtjk.mongodb.net/ATMWater_Refill?appName=ATMRefill';

async function unbindCard() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('已连接到数据库');

        // 解绑实物卡 B60590417
        const card = await RenrenCard.findOne({ cardNo: 'B60590417' });
        if (card) {
            console.log(`\n找到卡片: ${card.cardNo}`);
            console.log(`当前 localUserId: ${card.localUserId}`);

            // 解绑
            card.localUserId = undefined;
            await card.save();

            console.log('已解绑实物卡 B60590417');
        }

        // 检查是否还有其他绑定的卡片
        const boundCards = await RenrenCard.find({ localUserId: { $exists: true } });
        console.log(`\n当前还有 ${boundCards.length} 张卡片绑定了用户`);

        await mongoose.connection.close();
        console.log('\n完成！可以开始测试了');
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

unbindCard();
