-- 创建 user_logs 表
-- 用于存储用户上传的错误日志

CREATE TABLE IF NOT EXISTS user_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  logs LONGTEXT NOT NULL COMMENT '日志内容（JSON字符串）',
  deviceInfo JSON COMMENT '设备信息',
  appVersion VARCHAR(50) COMMENT 'APP版本号',
  uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- 外键约束
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,

  -- 索引
  INDEX idx_userId (userId),
  INDEX idx_uploadedAt (uploadedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户日志表';
