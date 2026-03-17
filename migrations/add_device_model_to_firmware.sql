-- 添加设备型号字段到固件版本表
-- 执行日期: 2026-03-17

ALTER TABLE firmware_versions
ADD COLUMN device_model VARCHAR(50) NULL COMMENT '适用设备型号' AFTER version;

-- 为现有数据设置默认值
UPDATE firmware_versions
SET device_model = 'ATM-ID-1000P'
WHERE device_model IS NULL;
