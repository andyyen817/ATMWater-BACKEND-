-- ========================================
-- 数据库迁移：添加Unit表新字段
-- 日期：2026-02-12
-- 目的：添加信号质量、CRC校验码、IMEI号字段
-- ========================================

-- 添加Unit表的新字段
ALTER TABLE units
ADD COLUMN signal_quality INT NULL COMMENT '信号质量（CSQ，0-31）',
ADD COLUMN crc_checksum VARCHAR(50) NULL COMMENT 'CRC校验码',
ADD COLUMN imei VARCHAR(50) NULL COMMENT 'IMEI号（原始DId）',
ADD INDEX idx_imei (imei);

-- 更新现有数据：从deviceId提取IMEI
-- deviceId格式：IMEI + "0001"，例如：898608311123900885420001
-- IMEI是前面的部分，去掉最后4位
UPDATE units
SET imei = LEFT(device_id, LENGTH(device_id) - 4)
WHERE LENGTH(device_id) > 4 AND imei IS NULL;

-- 验证迁移结果
SELECT
  device_id,
  imei,
  signal_quality,
  crc_checksum,
  CONCAT('IMEI: ', imei, ' + 0001 = ', device_id) AS verification
FROM units
LIMIT 5;
