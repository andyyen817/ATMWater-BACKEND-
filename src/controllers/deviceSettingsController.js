const DeviceSettings = require('../models/DeviceSettings');
const { sendCommandToDevice } = require('../services/tcpServer');

/**
 * @desc    获取设备参数
 * @route   GET /api/admin/device-settings/:deviceId
 */
exports.getDeviceSettings = async (req, res) => {
  try {
    const { deviceId } = req.params;

    let settings = await DeviceSettings.findOne({ where: { deviceId } });

    if (!settings) {
      // 返回默认参数
      settings = {
        deviceId,
        A1: 18.9, A2: 93, A3: 4.0,
        B1: 18.9, B2: 103, B3: 8.0,
        C1: 30, C2: 120, C3: 8, C4: 20
      };
    }

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('[DeviceSettings] Get error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * @desc    更新设备参数并发送到设备
 * @route   POST /api/admin/device-settings/:deviceId
 */
exports.updateDeviceSettings = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const params = req.body;

    // 1. 保存到数据库
    let settings = await DeviceSettings.findOne({ where: { deviceId } });

    if (!settings) {
      settings = await DeviceSettings.create({
        deviceId,
        ...params,
        updatedBy: req.user.id
      });
    } else {
      await settings.update({
        ...params,
        updatedBy: req.user.id
      });
    }

    // 2. 发送Settings命令到设备
    try {
      await sendCommandToDevice(deviceId, {
        Cmd: 'Settings',
        ...params,
        RC: Date.now().toString()
      });

      res.status(200).json({
        success: true,
        message: 'Settings updated and sent to device',
        data: settings
      });
    } catch (tcpError) {
      // 设备离线，只保存到数据库
      res.status(200).json({
        success: true,
        message: 'Settings saved (device offline, will sync when online)',
        data: settings,
        deviceOffline: true
      });
    }

  } catch (error) {
    console.error('[DeviceSettings] Update error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * @desc    从设备查询参数
 * @route   POST /api/admin/device-settings/:deviceId/query
 */
exports.queryDeviceSettings = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // 发送QuerySets命令到设备
    const response = await sendCommandToDevice(deviceId, {
      Cmd: 'QuerySets',
      RC: Date.now().toString()
    });

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('[DeviceSettings] Query error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Device offline or query failed'
    });
  }
};
