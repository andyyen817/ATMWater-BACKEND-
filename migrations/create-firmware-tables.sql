-- Create firmware_versions table
CREATE TABLE IF NOT EXISTS firmware_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,
  crc32 VARCHAR(20) NOT NULL,
  description TEXT,
  uploaded_by INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_version (version),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create upgrade_tasks table
CREATE TABLE IF NOT EXISTS upgrade_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firmware_version_id INT NOT NULL,
  unit_id INT NOT NULL,
  device_id VARCHAR(50) NOT NULL,
  status ENUM('Pending', 'InProgress', 'Completed', 'Failed', 'Cancelled') DEFAULT 'Pending',
  progress INT DEFAULT 0,
  current_packet INT DEFAULT 0,
  total_packets INT DEFAULT 0,
  version_before VARCHAR(50),
  version_after VARCHAR(50),
  error_message TEXT,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  initiated_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (firmware_version_id) REFERENCES firmware_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_firmware_version (firmware_version_id),
  INDEX idx_unit (unit_id),
  INDEX idx_device (device_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
