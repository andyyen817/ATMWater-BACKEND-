// 数据库数据检查脚本
// 检查maintenance_logs和water_quality_logs表的数据情况

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'mysql',
    logging: false
});

async function checkDatabaseData() {
    try {
        console.log('='.repeat(80));
        console.log('数据库数据检查报告');
        console.log('='.repeat(80));
        console.log();

        await sequelize.authenticate();
        console.log('✅ 已连接到Zeabur MySQL数据库');
        console.log();

        // 1. 检查units表数据
        console.log('📊 1. 设备数据统计');
        console.log('-'.repeat(80));

        const [unitStats] = await sequelize.query(`
            SELECT
                COUNT(*) as total_devices,
                SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) as online_count,
                SUM(CASE WHEN status = 'Offline' THEN 1 ELSE 0 END) as offline_count,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count
            FROM units
        `);

        console.log(`  总设备数: ${unitStats[0].total_devices}`);
        console.log(`  在线设备: ${unitStats[0].online_count}`);
        console.log(`  离线设备: ${unitStats[0].offline_count}`);
        console.log(`  激活设备: ${unitStats[0].active_count}`);
        console.log();

        // 2. 列出所有设备
        const [units] = await sequelize.query(`
            SELECT id, device_id, device_name, location, status,
                   tds_value, temperature, last_heartbeat_at
            FROM units
            ORDER BY id
            LIMIT 10
        `);

        console.log('  前10个设备列表:');
        units.forEach((unit, index) => {
            console.log(`    ${index + 1}. ID:${unit.id} | DeviceID:${unit.device_id} | 名称:${unit.device_name || unit.location} | 状态:${unit.status}`);
        });
        console.log();

        // 3. 检查maintenance_logs表数据
        console.log('📝 2. 维护日志数据统计');
        console.log('-'.repeat(80));

        const [maintenanceStats] = await sequelize.query(`
            SELECT
                COUNT(*) as total_logs,
                COUNT(DISTINCT device_id) as devices_with_logs,
                SUM(CASE WHEN status = 'Verified' THEN 1 ELSE 0 END) as verified_count,
                MIN(created_at) as earliest_log,
                MAX(created_at) as latest_log
            FROM maintenance_logs
        `);

        console.log(`  总维护日志数: ${maintenanceStats[0].total_logs}`);
        console.log(`  有维护日志的设备数: ${maintenanceStats[0].devices_with_logs}`);
        console.log(`  已验证日志数: ${maintenanceStats[0].verified_count}`);
        console.log(`  最早日志时间: ${maintenanceStats[0].earliest_log || '无'}`);
        console.log(`  最新日志时间: ${maintenanceStats[0].latest_log || '无'}`);
        console.log();

        // 4. 按设备统计维护日志
        const [maintenanceByDevice] = await sequelize.query(`
            SELECT
                device_id,
                COUNT(*) as log_count,
                MAX(created_at) as latest_log
            FROM maintenance_logs
            GROUP BY device_id
            ORDER BY log_count DESC
            LIMIT 10
        `);

        if (maintenanceByDevice.length > 0) {
            console.log('  维护日志最多的10个设备:');
            maintenanceByDevice.forEach((item, index) => {
                console.log(`    ${index + 1}. DeviceID:${item.device_id} | 日志数:${item.log_count} | 最新:${item.latest_log}`);
            });
        } else {
            console.log('  ⚠️  maintenance_logs表中没有数据');
        }
        console.log();

        // 5. 检查water_quality_logs表数据
        console.log('🌡️  3. 水质日志数据统计');
        console.log('-'.repeat(80));

        const [waterQualityStats] = await sequelize.query(`
            SELECT
                COUNT(*) as total_logs,
                COUNT(DISTINCT device_id) as devices_with_logs,
                AVG(pure_tds) as avg_pure_tds,
                AVG(ph) as avg_ph,
                AVG(temperature) as avg_temperature,
                MIN(timestamp) as earliest_log,
                MAX(timestamp) as latest_log
            FROM water_quality_logs
        `);

        console.log(`  总水质日志数: ${waterQualityStats[0].total_logs}`);
        console.log(`  有水质日志的设备数: ${waterQualityStats[0].devices_with_logs}`);
        console.log(`  平均纯水TDS: ${waterQualityStats[0].avg_pure_tds ? waterQualityStats[0].avg_pure_tds.toFixed(2) + ' PPM' : '无'}`);
        console.log(`  平均pH值: ${waterQualityStats[0].avg_ph ? waterQualityStats[0].avg_ph.toFixed(2) : '无'}`);
        console.log(`  平均温度: ${waterQualityStats[0].avg_temperature ? waterQualityStats[0].avg_temperature.toFixed(2) + '°C' : '无'}`);
        console.log(`  最早日志时间: ${waterQualityStats[0].earliest_log || '无'}`);
        console.log(`  最新日志时间: ${waterQualityStats[0].latest_log || '无'}`);
        console.log();

        // 6. 按设备统计水质日志
        const [waterQualityByDevice] = await sequelize.query(`
            SELECT
                device_id,
                COUNT(*) as log_count,
                AVG(pure_tds) as avg_tds,
                MAX(timestamp) as latest_log
            FROM water_quality_logs
            GROUP BY device_id
            ORDER BY log_count DESC
            LIMIT 10
        `);

        if (waterQualityByDevice.length > 0) {
            console.log('  水质日志最多的10个设备:');
            waterQualityByDevice.forEach((item, index) => {
                console.log(`    ${index + 1}. DeviceID:${item.device_id} | 日志数:${item.log_count} | 平均TDS:${item.avg_tds ? item.avg_tds.toFixed(2) : 'N/A'} | 最新:${item.latest_log}`);
            });
        } else {
            console.log('  ⚠️  water_quality_logs表中没有数据');
        }
        console.log();

        // 7. 数据完整性检查
        console.log('🔍 4. 数据完整性检查');
        console.log('-'.repeat(80));

        const [completeness] = await sequelize.query(`
            SELECT
                u.id,
                u.device_id,
                u.device_name,
                u.status,
                COALESCE(ml.maintenance_count, 0) as maintenance_logs,
                COALESCE(wql.water_quality_count, 0) as water_quality_logs
            FROM units u
            LEFT JOIN (
                SELECT unit_id, COUNT(*) as maintenance_count
                FROM maintenance_logs
                GROUP BY unit_id
            ) ml ON u.id = ml.unit_id
            LEFT JOIN (
                SELECT unit_id, COUNT(*) as water_quality_count
                FROM water_quality_logs
                GROUP BY unit_id
            ) wql ON u.id = wql.unit_id
            ORDER BY u.id
            LIMIT 10
        `);

        console.log('  前10个设备的数据完整性:');
        completeness.forEach((item, index) => {
            const status = item.maintenance_logs === 0 && item.water_quality_logs === 0 ? '❌ 缺少所有日志' :
                          item.maintenance_logs === 0 ? '⚠️  缺少维护日志' :
                          item.water_quality_logs === 0 ? '⚠️  缺少水质日志' :
                          '✅ 数据完整';
            console.log(`    ${index + 1}. ID:${item.id} | DeviceID:${item.device_id} | 维护:${item.maintenance_logs}条 | 水质:${item.water_quality_logs}条 | ${status}`);
        });
        console.log();

        // 8. 缺失数据统计
        console.log('📋 5. 缺失数据统计');
        console.log('-'.repeat(80));

        const [missingData] = await sequelize.query(`
            SELECT
                SUM(CASE WHEN ml.unit_id IS NULL THEN 1 ELSE 0 END) as devices_without_maintenance,
                SUM(CASE WHEN wql.unit_id IS NULL THEN 1 ELSE 0 END) as devices_without_water_quality
            FROM units u
            LEFT JOIN (SELECT DISTINCT unit_id FROM maintenance_logs) ml ON u.id = ml.unit_id
            LEFT JOIN (SELECT DISTINCT unit_id FROM water_quality_logs) wql ON u.id = wql.unit_id
        `);

        console.log(`  缺少维护日志的设备数: ${missingData[0].devices_without_maintenance}`);
        console.log(`  缺少水质日志的设备数: ${missingData[0].devices_without_water_quality}`);
        console.log();

        // 9. 检查transactions表（硬件上传数据）
        console.log('💰 6. 交易数据统计（硬件上传）');
        console.log('-'.repeat(80));

        const [transactionStats] = await sequelize.query(`
            SELECT
                COUNT(*) as total_transactions,
                SUM(CASE WHEN type = 'WaterPurchase' THEN 1 ELSE 0 END) as water_purchase_count,
                SUM(CASE WHEN pulse_count IS NOT NULL THEN 1 ELSE 0 END) as with_pulse_count,
                SUM(CASE WHEN input_tds IS NOT NULL THEN 1 ELSE 0 END) as with_input_tds,
                SUM(CASE WHEN output_tds IS NOT NULL THEN 1 ELSE 0 END) as with_output_tds
            FROM transactions
        `);

        console.log(`  总交易数: ${transactionStats[0].total_transactions}`);
        console.log(`  购水交易数: ${transactionStats[0].water_purchase_count}`);
        console.log(`  包含脉冲数的交易: ${transactionStats[0].with_pulse_count}`);
        console.log(`  包含进水TDS的交易: ${transactionStats[0].with_input_tds}`);
        console.log(`  包含纯水TDS的交易: ${transactionStats[0].with_output_tds}`);
        console.log();

        console.log('='.repeat(80));
        console.log('✅ 数据检查完成！');
        console.log('='.repeat(80));

        await sequelize.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ 错误:', error.message);
        await sequelize.close();
        process.exit(1);
    }
}

checkDatabaseData();
