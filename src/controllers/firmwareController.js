const { FirmwareVersion, UpgradeTask, Unit, User } = require('../models');
const { calculateFileCRC32 } = require('../utils/crcUtils');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

/**
 * 上传固件文件
 * POST /api/firmware/upload
 */
exports.uploadFirmware = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { version, description } = req.body;

    if (!version) {
      // 删除已上传的文件
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Version is required' });
    }

    // 检查版本是否已存在
    const existing = await FirmwareVersion.findOne({ where: { version } });
    if (existing) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Version already exists' });
    }

    // 计算 CRC32
    const crc32 = await calculateFileCRC32(req.file.path);

    // 创建数据库记录
    const firmware = await FirmwareVersion.create({
      version,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      crc32,
      description: description || null,
      uploadedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Firmware uploaded successfully',
      data: {
        id: firmware.id,
        version: firmware.version,
        fileName: firmware.fileName,
        fileSize: firmware.fileSize,
        crc32: firmware.crc32
      }
    });

  } catch (error) {
    console.error('[Firmware] Upload error:', error);
    // 清理文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * 获取所有固件版本
 * GET /api/firmware/versions
 */
exports.getFirmwareVersions = async (req, res) => {
  try {
    const versions = await FirmwareVersion.findAll({
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'phoneNumber']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('[Firmware] Get versions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * 删除固件版本
 * DELETE /api/firmware/versions/:id
 */
exports.deleteFirmwareVersion = async (req, res) => {
  try {
    const { id } = req.params;

    const firmware = await FirmwareVersion.findByPk(id);
    if (!firmware) {
      return res.status(404).json({ success: false, message: 'Firmware not found' });
    }

    // 检查是否有进行中的升级任务
    const activeTask = await UpgradeTask.findOne({
      where: {
        firmwareVersionId: id,
        status: { [Op.in]: ['Pending', 'InProgress'] }
      }
    });

    if (activeTask) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete firmware with active upgrade tasks'
      });
    }

    // 删除文件
    if (fs.existsSync(firmware.filePath)) {
      fs.unlinkSync(firmware.filePath);
    }

    // 删除数据库记录
    await firmware.destroy();

    res.json({ success: true, message: 'Firmware deleted successfully' });
  } catch (error) {
    console.error('[Firmware] Delete error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * 筛选设备
 * POST /api/firmware/filter-devices
 */
exports.filterDevices = async (req, res) => {
  try {
    const { companyId, location, firmwareVersion, simNumber, deviceNumber } = req.body;

    const where = { isActive: true };

    if (companyId) where.stewardId = companyId;
    if (location) where.location = { [Op.like]: `%${location}%` };
    if (firmwareVersion) where.firmwareVersion = firmwareVersion;
    if (simNumber) where.imei = { [Op.like]: `%${simNumber}%` };
    if (deviceNumber) where.deviceId = { [Op.like]: `%${deviceNumber}%` };

    const devices = await Unit.findAll({
      where,
      attributes: ['id', 'deviceId', 'deviceName', 'location', 'firmwareVersion', 'imei', 'status'],
      order: [['deviceId', 'ASC']]
    });

    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('[Firmware] Filter devices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * 批量创建升级任务
 * POST /api/firmware/upgrade/batch
 */
exports.createBatchUpgrade = async (req, res) => {
  try {
    const { firmwareVersionId, deviceIds } = req.body;

    if (!firmwareVersionId || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    // 验证固件版本
    const firmware = await FirmwareVersion.findByPk(firmwareVersionId);
    if (!firmware || !firmware.isActive) {
      return res.status(404).json({ success: false, message: 'Firmware not found or inactive' });
    }

    // 查找设备
    const units = await Unit.findAll({
      where: { deviceId: { [Op.in]: deviceIds } }
    });

    if (units.length === 0) {
      return res.status(404).json({ success: false, message: 'No devices found' });
    }

    // 创建升级任务
    const tasks = await Promise.all(
      units.map(unit =>
        UpgradeTask.create({
          firmwareVersionId,
          unitId: unit.id,
          deviceId: unit.deviceId,
          versionBefore: unit.firmwareVersion,
          versionAfter: firmware.version,
          initiatedBy: req.user.id,
          status: 'Pending'
        })
      )
    );

    res.status(201).json({
      success: true,
      message: `Created ${tasks.length} upgrade tasks`,
      data: { taskCount: tasks.length, tasks }
    });

  } catch (error) {
    console.error('[Firmware] Create batch upgrade error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * 获取升级任务列表
 * GET /api/firmware/upgrade/tasks
 */
exports.getUpgradeTasks = async (req, res) => {
  try {
    const { status, deviceId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (deviceId) where.deviceId = deviceId;

    const tasks = await UpgradeTask.findAll({
      where,
      include: [
        {
          model: FirmwareVersion,
          as: 'firmware',
          attributes: ['version', 'fileName']
        },
        {
          model: Unit,
          as: 'unit',
          attributes: ['deviceId', 'deviceName', 'location', 'imei']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('[Firmware] Get tasks error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * 取消升级任务
 * POST /api/firmware/upgrade/cancel/:taskId
 */
exports.cancelUpgradeTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await UpgradeTask.findByPk(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.status === 'Completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed task' });
    }

    await task.update({ status: 'Cancelled' });

    res.json({ success: true, message: 'Task cancelled successfully' });
  } catch (error) {
    console.error('[Firmware] Cancel task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = exports;
