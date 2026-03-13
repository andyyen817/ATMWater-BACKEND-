-- 清理测试数据脚本
-- 在运行 init-production-data.js 之前执行此脚本

-- 1. 清理RFID卡 (以99092开头的测试卡)
DELETE FROM physical_cards WHERE rfid LIKE '99092%';

-- 2. 清理测试用户 (以+628123456789开头的手机号)
DELETE FROM users WHERE phone LIKE '+628123456789%';

-- 3. 清理测试设备
DELETE FROM units WHERE device_id = '898608311123900885420001';

-- 4. 验证清理结果
SELECT '=== 清理后的数据统计 ===' AS info;
SELECT COUNT(*) AS physical_cards_count FROM physical_cards;
SELECT COUNT(*) AS test_users_count FROM users WHERE role = 'User';
SELECT COUNT(*) AS units_count FROM units;
