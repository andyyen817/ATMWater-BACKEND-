-- 修改用户表以支持仅邮箱注册
-- 执行日期: 2026-03-11

-- 1. 将 phone 字段改为可选（NULLABLE）
ALTER TABLE users
  MODIFY COLUMN phone VARCHAR(20) NULL;

-- 2. 为 email 字段添加唯一约束
ALTER TABLE users
  ADD UNIQUE KEY unique_email (email);

-- 3. 验证修改
-- 查看表结构
DESCRIBE users;

-- 查看索引
SHOW INDEX FROM users;
