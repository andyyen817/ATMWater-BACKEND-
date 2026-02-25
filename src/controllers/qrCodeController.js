const { Unit } = require('../models');
const { generateQRPayload } = require('../utils/qrcode');

/**
 * GET /api/admin/units/:deviceId/qrcode
 * 生成单个设备的 QR 码数据
 */
exports.generateDeviceQR = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const unit = await Unit.findOne({
      where: { deviceId },
      attributes: ['deviceId', 'deviceName', 'location']
    });

    if (!unit) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    const qrData = generateQRPayload(deviceId);

    return res.json({
      success: true,
      data: {
        ...qrData,
        deviceName: unit.deviceName,
        location: unit.location
      }
    });
  } catch (error) {
    console.error('[QR Generate] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/units/qrcodes/batch
 * 批量生成所有活跃设备的 QR 码
 */
exports.generateBatchQR = async (req, res) => {
  try {
    const units = await Unit.findAll({
      where: { isActive: true },
      attributes: ['deviceId', 'deviceName', 'location']
    });

    const qrCodes = units.map(unit => ({
      ...generateQRPayload(unit.deviceId),
      deviceName: unit.deviceName,
      location: unit.location
    }));

    return res.json({ success: true, data: qrCodes });
  } catch (error) {
    console.error('[QR Batch Generate] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
