/**
 * 测试 DailyDispenseCounter 模型
 */

require('dotenv').config();
const DailyDispenseCounter = require('./src/models/DailyDispenseCounter');

async function testDailyCounter() {
  try {
    console.log('🧪 测试 DailyDispenseCounter 模型...\n');

    // 1. 测试模型加载
    console.log('1️⃣ 模型加载测试:');
    console.log('✅ DailyDispenseCounter 模型加载成功');
    console.log(`   表名: ${DailyDispenseCounter.tableName}`);
    console.log(`   字段: ${Object.keys(DailyDispenseCounter.rawAttributes).join(', ')}\n`);

    // 2. 测试查询今日计数器
    console.log('2️⃣ 查询今日计数器:');
    const today = new Date().toISOString().slice(0, 10);
    console.log(`   日期: ${today}`);

    const counters = await DailyDispenseCounter.findAll({
      where: { date: today },
      limit: 5
    });

    console.log(`   找到 ${counters.length} 条记录\n`);

    if (counters.length > 0) {
      console.log('   示例数据:');
      counters.forEach(c => {
        console.log(`   - Unit ${c.unitId}: ${c.appBackedVolume}L (阈值${c.thresholdReached ? '已达' : '未达'})`);
      });
    } else {
      console.log('   ℹ️  今日暂无计数器记录（正常，首次出水时会自动创建）');
    }

    console.log('\n✅ DailyDispenseCounter 模型测试通过！');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testDailyCounter();
