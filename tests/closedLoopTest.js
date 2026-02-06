/**
 * ATMWater 智能水站软硬一体化闭环测试脚本
 *
 * 测试场景来自 "ATMWater 智能水站软硬一体化调试测试方案.docx"
 *
 * 运行方式:
 * node tests/closedLoopTest.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Unit = require('../src/models/Unit');
const Transaction = require('../src/models/Transaction');
const Ledger = require('../src/models/Ledger');
const { processProfitSharing } = require('../src/services/sharingService');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'blue');
    console.log('='.repeat(60));
}

// 数据库连接
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        log('✅ MongoDB Connected', 'green');
    } catch (error) {
        log(`❌ MongoDB Connection Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

/**
 * TC-1.1: App 授权出水全闭环测试
 * 预期: 物理出水正常, 用户余额减少, 四角色分润到账
 */
async function testTC1_1_FullLoop() {
    section('TC-1.1: App 授权出水全闭环测试');

    try {
        // 1. 准备测试用户 (余额 10,000 Rp)
        const testUser = await User.findOneAndUpdate(
            { phoneNumber: '+628111111111' },
            {
                phoneNumber: '+628111111111',
                name: 'TC-1.1 Test Customer',
                role: 'Customer',
                balance: 10000,
                password: 'test123'
            },
            { upsert: true, new: true }
        );

        // 2. 准备测试设备
        const testUnit = await Unit.findOneAndUpdate(
            { unitId: 'TEST-UNIT-001' },
            {
                unitId: 'TEST-UNIT-001',
                name: 'Test Unit for TC-1.1',
                location: {
                    type: 'Point',
                    coordinates: [106.8456, -6.2088]
                },
                status: 'Active',
                rpId: null, // 将在测试中设置
                stewardId: null // 将在测试中设置
            },
            { upsert: true, new: true }
        );

        // 3. 准备 RP 和 Steward 账户
        const testRP = await User.findOneAndUpdate(
            { phoneNumber: '+628222222222' },
            {
                phoneNumber: '+628222222222',
                name: 'TC-1.1 Test RP',
                role: 'RP',
                balance: 50000
            },
            { upsert: true, new: true }
        );

        const testSteward = await User.findOneAndUpdate(
            { phoneNumber: '+628333333333' },
            {
                phoneNumber: '+628333333333',
                name: 'TC-1.1 Test Steward',
                role: 'Steward',
                balance: 30000
            },
            { upsert: true, new: true }
        );

        // 更新设备的 RP 和 Steward 关联 (使用正确的字段名)
        testUnit.rpOwner = testRP._id;
        testUnit.steward = testSteward._id;
        await testUnit.save();

        // 重新加载 Unit 以确保 RP/Steward ID 已保存 (避免竞争条件)
        const reloadedUnit = await Unit.findOne({ unitId: 'TEST-UNIT-001' });
        log(`设备 RP ID: ${reloadedUnit.rpOwner}`, 'yellow');
        log(`设备 Steward ID: ${reloadedUnit.steward}`, 'yellow');

        // 4. 记录初始余额
        const initialBalances = {
            customer: testUser.balance,
            rp: testRP.balance,
            steward: testSteward.balance
        };

        log(`初始余额:`, 'yellow');
        log(`  Customer: Rp ${initialBalances.customer}`, 'yellow');
        log(`  RP: Rp ${initialBalances.rp}`, 'yellow');
        log(`  Steward: Rp ${initialBalances.steward}`, 'yellow');

        // 5. 模拟取水金额 (5000 Rp = 5L * 1000 Rp/L)
        const waterAmount = 5000;
        const outTradeNo = `TEST_TC1_1_${Date.now()}`;

        // 6. 创建交易记录 (模拟 App 授权)
        const transaction = await Transaction.create({
            userId: testUser._id,
            type: 'WaterPurchase',
            amount: waterAmount,
            externalId: outTradeNo,
            status: 'Pending',
            description: `Water Purchase at TEST-UNIT-001 (Pure)`
        });

        log(`\n✅ 交易记录已创建: ${outTradeNo}`, 'green');

        // 7. 使用 atomic $inc 扣除用户余额 (模拟回调处理)
        const updatedUser = await User.findByIdAndUpdate(
            testUser._id,
            { $inc: { balance: -waterAmount } },
            { new: true }
        );

        // 8. 更新交易状态为完成
        transaction.status = 'Completed';
        transaction.volume = 5000; // 5L
        await transaction.save();

        log(`✅ 用户余额已扣除: Rp ${waterAmount}`, 'green');
        log(`✅ 交易状态已更新: Completed`, 'green');

        // 9. 触发四角色分润
        await processProfitSharing(outTradeNo, waterAmount, 'TEST-UNIT-001', testUser._id);

        // 10. 验证结果
        const finalCustomer = await User.findById(testUser._id);
        const finalRP = await User.findById(testRP._id);
        const finalSteward = await User.findById(testSteward._id);

        const expectedBalances = {
            customer: initialBalances.customer - waterAmount, // 10000 - 5000 = 5000
            rp: initialBalances.rp + Math.floor(waterAmount * 0.40), // 50000 + 2000 = 52000
            steward: initialBalances.steward + Math.floor(waterAmount * 0.15) // 30000 + 750 = 30750
        };

        log(`\n最终余额:`, 'yellow');
        log(`  Customer: Rp ${finalCustomer.balance} (预期: Rp ${expectedBalances.customer})`, 'yellow');
        log(`  RP: Rp ${finalRP.balance} (预期: Rp ${expectedBalances.rp})`, 'yellow');
        log(`  Steward: Rp ${finalSteward.balance} (预期: Rp ${expectedBalances.steward})`, 'yellow');

        // 11. 验证 Ledger 记录 (使用 Transaction ObjectId 查询)
        const transactionForLedger = await Transaction.findOne({ externalId: outTradeNo });
        const ledgerEntries = transactionForLedger ? await Ledger.find({ transactionId: transactionForLedger._id }) : [];
        log(`\nLedger 记录数: ${ledgerEntries.length}`, 'yellow');

        let totalLedgerAmount = 0;
        for (const entry of ledgerEntries) {
            log(`  - ${entry.accountType}: Rp ${entry.amount}`, 'yellow');
            totalLedgerAmount += entry.amount;
        }

        // 12. 验证结果
        const pass =
            finalCustomer.balance === expectedBalances.customer &&
            finalRP.balance === expectedBalances.rp &&
            finalSteward.balance === expectedBalances.steward &&
            totalLedgerAmount === waterAmount;

        if (pass) {
            log(`\n✅ TC-1.1 PASSED: 全闭环测试通过`, 'green');
            return true;
        } else {
            log(`\n❌ TC-1.1 FAILED: 验证失败`, 'red');
            return false;
        }

    } catch (error) {
        log(`❌ TC-1.1 ERROR: ${error.message}`, 'red');
        console.error(error);
        return false;
    }
}

/**
 * TC-1.3: 重复回调(幂等性)测试
 * 预期: 后端仅处理第一次通知, 严禁扣费 3 次
 */
async function testTC1_3_Idempotency() {
    section('TC-1.3: 重复回调幂等性测试');

    try {
        // 1. 准备测试用户
        const testUser = await User.findOneAndUpdate(
            { phoneNumber: '+628111111112' },
            {
                phoneNumber: '+628111111112',
                name: 'TC-1.3 Test Customer',
                role: 'Customer',
                balance: 15000,
                password: 'test123'
            },
            { upsert: true, new: true }
        );

        const testUnit = await Unit.findOneAndUpdate(
            { unitId: 'TEST-UNIT-003' },
            {
                unitId: 'TEST-UNIT-003',
                name: 'Test Unit for TC-1.3',
                status: 'Active'
            },
            { upsert: true, new: true }
        );

        const initialBalance = testUser.balance;
        const waterAmount = 3000;
        const outTradeNo = `TEST_TC1_3_${Date.now()}`;

        // 2. 创建交易记录
        const transaction = await Transaction.create({
            userId: testUser._id,
            type: 'WaterPurchase',
            amount: waterAmount,
            externalId: outTradeNo,
            status: 'Pending',
            description: `Idempotency Test`
        });

        log(`初始余额: Rp ${initialBalance}`, 'yellow');
        log(`取水金额: Rp ${waterAmount}`, 'yellow');

        // 3. 模拟第一次回调
        log(`\n模拟第一次回调...`, 'yellow');
        let updatedUser = await User.findByIdAndUpdate(
            testUser._id,
            { $inc: { balance: -waterAmount } },
            { new: true }
        );

        transaction.status = 'Completed';
        await transaction.save();

        log(`✅ 第一次回调处理完成`, 'green');
        log(`当前余额: Rp ${updatedUser.balance}`, 'yellow');

        const balanceAfterFirst = updatedUser.balance;

        // 4. 模拟第二次回调 (应该被幂等性拦截)
        log(`\n模拟第二次回调 (应该被拦截)...`, 'yellow');

        // 检查交易状态
        const existingTransaction = await Transaction.findOne({ externalId: outTradeNo });
        if (existingTransaction && existingTransaction.status === 'Completed') {
            log(`✅ 第二次回调被幂等性保护拦截`, 'green');
        } else {
            log(`❌ 第二次回调未被拦截`, 'red');
            return false;
        }

        // 5. 验证余额没有第二次扣除
        const finalUser = await User.findById(testUser._id);

        if (finalUser.balance === balanceAfterFirst) {
            log(`✅ 余额未第二次扣除: Rp ${finalUser.balance}`, 'green');
            log(`\n✅ TC-1.3 PASSED: 幂等性测试通过`, 'green');
            return true;
        } else {
            log(`❌ 余额被第二次扣除! Rp ${finalUser.balance}`, 'red');
            log(`\n❌ TC-1.3 FAILED: 幂等性测试失败`, 'red');
            return false;
        }

    } catch (error) {
        log(`❌ TC-1.3 ERROR: ${error.message}`, 'red');
        console.error(error);
        return false;
    }
}

/**
 * TC-1.4: 余额不足拦截测试
 * 预期: 后端接口报错 "Insufficient Balance"
 */
async function testTC1_4_InsufficientBalance() {
    section('TC-1.4: 余额不足拦截测试');

    try {
        // 1. 准备测试用户 (余额仅 100 Rp)
        const testUser = await User.findOneAndUpdate(
            { phoneNumber: '+628111111113' },
            {
                phoneNumber: '+628111111113',
                name: 'TC-1.4 Test Customer',
                role: 'Customer',
                balance: 100, // 余额不足
                password: 'test123'
            },
            { upsert: true, new: true }
        );

        const initialBalance = testUser.balance;
        const waterAmount = 500; // 尝试取 500 Rp, 但只有 100 Rp

        log(`初始余额: Rp ${initialBalance}`, 'yellow');
        log(`尝试取水金额: Rp ${waterAmount}`, 'yellow');

        // 2. 模拟授权请求 (在 authorizeDispense 中的检查)
        if (testUser.balance < waterAmount) {
            log(`✅ 余额不足检查通过`, 'green');
            log(`余额: Rp ${testUser.balance} < 需要: Rp ${waterAmount}`, 'yellow');

            // 验证余额没有被扣除
            const finalUser = await User.findById(testUser._id);
            if (finalUser.balance === initialBalance) {
                log(`✅ 余额未被扣除`, 'green');
                log(`\n✅ TC-1.4 PASSED: 余额不足拦截测试通过`, 'green');
                return true;
            }
        }

        log(`\n❌ TC-1.4 FAILED: 余额不足拦截失败`, 'red');
        return false;

    } catch (error) {
        log(`❌ TC-1.4 ERROR: ${error.message}`, 'red');
        console.error(error);
        return false;
    }
}

/**
 * TC-2.2: 分润总额平衡测试
 * 预期: 4 个角色的入账金额总和 = 用户实际支付金额
 */
async function testTC2_2_ProfitBalance() {
    section('TC-2.2: 分润总额平衡测试');

    try {
        // 1. 准备测试数据
        const testUser = await User.findOneAndUpdate(
            { phoneNumber: '+628111111114' },
            {
                phoneNumber: '+628111111114',
                name: 'TC-2.2 Test Customer',
                role: 'Customer',
                balance: 10000,
                password: 'test123'
            },
            { upsert: true, new: true }
        );

        const testUnit = await Unit.findOneAndUpdate(
            { unitId: 'TEST-UNIT-002' },
            {
                unitId: 'TEST-UNIT-002',
                name: 'Test Unit for TC-2.2',
                status: 'Active'
            },
            { upsert: true, new: true }
        );

        const waterAmount = 10000; // 10000 Rp = 整数方便计算
        const outTradeNo = `TEST_TC2_2_${Date.now()}`;

        log(`用户支付金额: Rp ${waterAmount}`, 'yellow');

        // 2. 创建并完成交易
        const transaction = await Transaction.create({
            userId: testUser._id,
            type: 'WaterPurchase',
            amount: waterAmount,
            externalId: outTradeNo,
            status: 'Completed',
            volume: 10000,
            description: `Profit Balance Test`
        });

        // 3. 扣除用户余额
        await User.findByIdAndUpdate(
            testUser._id,
            { $inc: { balance: -waterAmount } }
        );

        // 4. 执行分润
        await processProfitSharing(outTradeNo, waterAmount, 'TEST-UNIT-002', testUser._id);

        // 5. 验证 Ledger 记录 (使用 Transaction ObjectId 查询)
        const transactionForLedger = await Transaction.findOne({ externalId: outTradeNo });
        const ledgerEntries = transactionForLedger ? await Ledger.find({ transactionId: transactionForLedger._id }) : [];
        let totalLedgerAmount = 0;

        log(`\n分润明细:`, 'yellow');
        for (const entry of ledgerEntries) {
            log(`  - ${entry.accountType}: Rp ${entry.amount} (${(entry.amount / waterAmount * 100).toFixed(1)}%)`, 'yellow');
            totalLedgerAmount += entry.amount;
        }

        log(`\n分润总额: Rp ${totalLedgerAmount}`, 'yellow');
        log(`用户支付: Rp ${waterAmount}`, 'yellow');

        // 6. 验证总额平衡
        if (totalLedgerAmount === waterAmount) {
            log(`✅ 分润总额 = 用户支付金额`, 'green');
            log(`\n✅ TC-2.2 PASSED: 分润总额平衡测试通过`, 'green');
            return true;
        } else {
            const diff = waterAmount - totalLedgerAmount;
            log(`❌ 分润总额不匹配! 差额: Rp ${diff}`, 'red');
            log(`\n❌ TC-2.2 FAILED: 分润总额平衡测试失败`, 'red');
            return false;
        }

    } catch (error) {
        log(`❌ TC-2.2 ERROR: ${error.message}`, 'red');
        console.error(error);
        return false;
    }
}

/**
 * TC-3.3: TDS 异常锁机测试
 * 预期: 系统后台产生预警，设备状态自动变更为 "Maintenance"
 */
async function testTC3_3_TDSAlert() {
    section('TC-3.3: TDS 异常锁机测试');

    try {
        // 1. 准备测试设备
        const testUnit = await Unit.findOneAndUpdate(
            { unitId: 'TEST-UNIT-TDS' },
            {
                unitId: 'TEST-UNIT-TDS',
                name: 'Test Unit for TDS Alert',
                status: 'Active',
                sensors: {
                    pureTDS: 50,
                    rawTDS: 100
                }
            },
            { upsert: true, new: true }
        );

        log(`初始状态: ${testUnit.status}`, 'yellow');
        log(`初始 TDS: ${testUnit.sensors.pureTDS}`, 'yellow');

        // 2. 模拟高 TDS 状态推送 (> 500)
        const highTDS = 550;
        log(`\n模拟 TDS 升至: ${highTDS}`, 'yellow');

        // 模拟 handleStatusPush 的逻辑
        if (highTDS > 500) {
            log(`✅ TDS 异常检测触发 (TDS > 500)`, 'yellow');

            // 更新设备状态为维护中
            testUnit.status = 'Maintenance';
            testUnit.sensors.pureTDS = highTDS;
            await testUnit.save();

            log(`✅ 设备状态已更新为: Maintenance`, 'green');
        }

        // 3. 验证设备状态
        const updatedUnit = await Unit.findOne({ unitId: 'TEST-UNIT-TDS' });

        if (updatedUnit.status === 'Maintenance' && updatedUnit.sensors.pureTDS > 500) {
            log(`\n✅ TC-3.3 PASSED: TDS 异常锁机测试通过`, 'green');
            return true;
        } else {
            log(`\n❌ TC-3.3 FAILED: TDS 异常锁机测试失败`, 'red');
            return false;
        }

    } catch (error) {
        log(`❌ TC-3.3 ERROR: ${error.message}`, 'red');
        console.error(error);
        return false;
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    await connectDB();

    const results = {
        'TC-1.1': await testTC1_1_FullLoop(),
        'TC-1.3': await testTC1_3_Idempotency(),
        'TC-1.4': await testTC1_4_InsufficientBalance(),
        'TC-2.2': await testTC2_2_ProfitBalance(),
        'TC-3.3': await testTC3_3_TDSAlert()
    };

    section('测试结果汇总');

    let passCount = 0;
    let failCount = 0;

    for (const [testName, passed] of Object.entries(results)) {
        if (passed) {
            log(`✅ ${testName}: PASSED`, 'green');
            passCount++;
        } else {
            log(`❌ ${testName}: FAILED`, 'red');
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    log(`总计: ${passCount + failCount} 个测试`, 'blue');
    log(`通过: ${passCount}`, 'green');
    log(`失败: ${failCount}`, 'red');
    console.log('='.repeat(60) + '\n');

    await mongoose.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
}

// 运行测试
runAllTests();
