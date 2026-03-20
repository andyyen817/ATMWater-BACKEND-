const crypto = require('crypto');

const QR_SECRET = process.env.QR_SECRET || 'atmwater-qr-secret-key-2026';

/**
 * 生成设备 QR 码 payload
 * @param {string} deviceId - 设备ID
 * @param {number} [outletNo] - 出水口编号（1=矿物质水, 2=纯净水），不传则不区分
 * @returns {{ url: string, deviceId: string, outletNo?: number }}
 */
function generateQRPayload(deviceId, outletNo) {
  const suffix = outletNo !== undefined ? `-${outletNo}` : '';
  return {
    url: `https://qr.airkop.com/qrcode/atmwater/${deviceId}${suffix}`,
    deviceId,
    outletNo
  };
}

/**
 * 解析并验证 QR 码内容
 * 支持两种格式：
 *   1) 旧格式（兼容）：atmwater://dispense?d={deviceId}&t={timestamp}&s={signature}
 *   2) 新格式：https://qr.airkop.com/qrcode/atmwater/{deviceId} 或 {deviceId}-{outletNo}
 * @param {string} qrString - QR 码扫描内容
 * @returns {{ valid: boolean, deviceId?: string, outletNo?: number, timestamp?: number, error?: string }}
 */
function parseAndValidateQR(qrString) {
  if (!qrString) {
    return { valid: false, error: 'Empty QR code' };
  }

  // 格式1（旧格式，保留兼容）：atmwater://dispense?d={deviceId}&t={ts}&s={sig}
  if (qrString.startsWith('atmwater://')) {
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

  // 格式2（新格式）：https://qr.airkop.com/qrcode/atmwater/{deviceId} 或 {deviceId}-{outletNo}
  const stationMatch = qrString.match(
    /^https:\/\/(?:qr|www)\.airkop\.com\/qrcode\/atmwater\/([A-Za-z0-9]+(?:-\d+)?)(?:[/?].*)?$/
  );
  if (stationMatch) {
    const raw = stationMatch[1];
    const outletMatch = raw.match(/^(.+)-(\d+)$/);
    if (outletMatch) {
      // 带出水口编号：898523420222598612750001-1
      return { valid: true, deviceId: outletMatch[1], outletNo: parseInt(outletMatch[2]) };
    }
    // 不带编号：直接返回 deviceId
    return { valid: true, deviceId: raw };
  }

  return { valid: false, error: 'Invalid QR format' };
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
