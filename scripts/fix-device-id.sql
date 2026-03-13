-- 修复水站设备ID问题
-- 问题: 第2行的deviceId被错误地设置为IMEI值

-- 1. 查看当前问题数据
SELECT id, device_id, imei, device_name, location
FROM units
WHERE device_id = '89860831112390088542';

-- 2. 修正deviceId (将IMEI值改为正确的设备ID)
UPDATE units
SET device_id = '898608311123900885420002'
WHERE device_id = '89860831112390088542';

-- 3. 验证修复结果
SELECT id, device_id, imei, device_name, location
FROM units
ORDER BY created_at;

-- 预期结果:
-- Row 1: device_id = '898608311123900885420001', imei = '89860831112390088542'
-- Row 2: device_id = '898608311123900885420002', imei = NULL or other value
-- Row 3: device_id = 'DEVICE001', imei = NULL or other value
