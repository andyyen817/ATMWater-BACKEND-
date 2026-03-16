const fs = require('fs');

/**
 * 计算 CRC32 校验码（按用户提供的算法）
 * @param {Buffer} buffer - 文件数据
 * @returns {string} - CRC32 十进制字符串
 */
function calculateCRC32(buffer) {
  let ret = 0;
  let i = 0;
  let len = buffer.length;

  while (len > 0) {
    let step = len > 4 ? 4 : len;
    len = len - step;

    for (let k = step - 1; k >= 0; k--) {
      let value = buffer[i];
      ret = ret + (value << (8 * k));
      i = i + 1;
    }
  }

  return (ret >>> 0).toString(); // 转为无符号32位整数并转字符串
}

/**
 * 计算 CRC8 校验码（按用户提供的算法）
 * @param {Buffer} buffer - 数据包
 * @returns {number} - CRC8 值
 */
function calculateCRC8(buffer) {
  let ret = 0;

  for (let i = 0; i < buffer.length; i++) {
    let value = buffer[i];
    ret = ret + value;
  }

  return ret & 0xFF; // 取低8位
}

/**
 * 从文件路径计算 CRC32
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} - CRC32 值
 */
async function calculateFileCRC32(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(calculateCRC32(data));
      }
    });
  });
}

/**
 * 将文件分割为数据包 (每包最大 255 字节)
 * @param {string} filePath - 文件路径
 * @param {number} packetSize - 每包大小 (默认 255)
 * @returns {Promise<Buffer[]>} - 数据包数组
 */
async function splitFileIntoPackets(filePath, packetSize = 255) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const packets = [];
        for (let i = 0; i < data.length; i += packetSize) {
          packets.push(data.slice(i, i + packetSize));
        }
        resolve(packets);
      }
    });
  });
}

module.exports = {
  calculateCRC32,
  calculateCRC8,
  calculateFileCRC32,
  splitFileIntoPackets
};
