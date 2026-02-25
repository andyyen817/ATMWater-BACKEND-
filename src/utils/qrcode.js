const crypto = require('crypto');

const QR_SECRET = process.env.QR_SECRET || 'atmwater-qr-secret-key-2026';

/**
 * 生成设备 QR 码 payload
 * @param {string} deviceId - 设备ID
 * @returns {{ url: string, deviceId: string, timestamp: number, signature: string }}
 */
function generateQRPayload(deviceId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(deviceId, timestamp);
  return {
    url: `atmwater://dispense?d=${deviceId}&t=${timestamp}&s=${signature}`,
    deviceId,
    timestamp,
    signature
  };
}

/**
 * 解析并验证 QR 码内容
 * @param {string} qrString - QR 码扫描内容
 * @returns {{ valid: boolean, deviceId?: string, timestamp?: number, error?: string }}
 */
function parseAndValidateQR(qrString) {
  if (!qrString || !qrString.startsWith('atmwater://')) {
    return { valid: false, error: 'Invalid QR format' };
  }

  try {
    const url = new URL(qrString);
    const deviceId = url.searchParams.get('d');
    const timestamp = parseInt(url.searchParams.get('t'));
    const signature = url.searchParams.get('s');

    if (!deviceId || !timestamp || !signature) {
      return { valid: false, error: 'Missing QR parameters' };
    }

    const expectedSig = generateSignature(deviceId, timestamp);
    if (signature !== expectedSig) {
      return { valid: false, error: 'Invalid QR signature' };
    }

    return { valid: true, deviceId, timestamp };
  } catch (error) {
    return { valid: false, error: 'Failed to parse QR code' };
  }
}

/**
 * 生成 HMAC-SHA256 签名（取前8位hex）
 */
function generateSignature(deviceId, timestamp) {
  return crypto
    .createHmac('sha256', QR_SECRET)
    .update(`${deviceId}|${timestamp}`)
    .digest('hex')
    .substring(0, 8);
}

module.exports = { generateQRPayload, parseAndValidateQR };
