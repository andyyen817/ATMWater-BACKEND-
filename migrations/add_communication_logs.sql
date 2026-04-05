-- 添加 communicationLogs 字段到 applications 表
-- 执行时间: 2026-04-05
-- 说明: 用于存储管理员与申请人的沟通记录

-- 添加字段
ALTER TABLE applications
ADD COLUMN communicationLogs JSON DEFAULT '[]' COMMENT '沟通记录数组，格式：[{ adminId, adminName, content, createdAt }]';

-- 为现有记录初始化空数组
UPDATE applications
SET communicationLogs = '[]'
WHERE communicationLogs IS NULL;

-- 验证字段是否添加成功
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'zeabur'
  AND TABLE_NAME = 'applications'
  AND COLUMN_NAME = 'communicationLogs';
