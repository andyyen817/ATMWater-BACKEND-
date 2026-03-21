const { FirmwareVersion, UpgradeTask, Unit, User } = require('../models');
const { calculateFileCRC32 } = require('../utils/crcUtils');
const tcpServer = require('../services/tcpServer');
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

    const { version, description, deviceModel } = req.body;

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
      deviceModel: deviceModel || 'ATM-ID-1000P',
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
        deviceModel: firmware.deviceModel,
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

    // 添加 status 字段以兼容前端（基于 isActive）
    const versionsWithStatus = versions.map(v => {
      const data = v.toJSON();
      data.status = data.isActive ? 'active' : 'inactive';
      return data;
    });

    res.json({ success: true, data: versionsWithStatus });
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
      // 支持 force=true 强制取消所有关联任务后删除
      if (req.query.force === 'true') {
        await UpgradeTask.update(
          { status: 'Cancelled' },
          { where: { firmwareVersionId: id, status: { [Op.in]: ['Pending', 'InProgress'] } } }
        );
        console.log(`[Firmware] Force cancelled all active tasks for firmware ${id}`);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete firmware with active upgrade tasks'
        });
      }
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
    // 兼容前端参数名：firmwareId/firmwareVersionId, unitIds/deviceIds
    const firmwareVersionId = req.body.firmwareVersionId || req.body.firmwareId;
    const deviceIds = req.body.deviceIds || req.body.unitIds;

    console.log('[Firmware] createBatchUpgrade called');
    console.log('[Firmware] firmwareVersionId:', firmwareVersionId);
    console.log('[Firmware] deviceIds/unitIds:', deviceIds);

    if (!firmwareVersionId || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      console.error('[Firmware] Invalid parameters');
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    // 验证固件版本
    const firmware = await FirmwareVersion.findByPk(firmwareVersionId);
    if (!firmware || !firmware.isActive) {
      console.error('[Firmware] Firmware not found or inactive:', firmwareVersionId);
      return res.status(404).json({ success: false, message: 'Firmware not found or inactive' });
    }

    console.log('[Firmware] Firmware found:', firmware.version);

    // 查找设备 - 支持两种查询方式：
    // 1. 如果传入的是小整数（< 10000），按主键 id 查询
    // 2. 如果传入的是长字符串（IMEI/deviceId），按 deviceId 查询
    const isNumericIds = deviceIds.every(id => {
      const num = Number(id);
      return typeof id === 'number' || (typeof id === 'string' && !isNaN(num) && num < 10000);
    });

    let units;
    if (isNumericIds) {
      console.log('[Firmware] Querying by primary key (id)');
      units = await Unit.findAll({
        where: { id: { [Op.in]: deviceIds } }
      });
    } else {
      console.log('[Firmware] Querying by deviceId');
      units = await Unit.findAll({
        where: { deviceId: { [Op.in]: deviceIds } }
      });
    }

    console.log('[Firmware] Found units:', units.length);

    if (units.length === 0) {
      console.error('[Firmware] No devices found for IDs:', deviceIds);
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

    console.log('[Firmware] Created tasks:', tasks.length);

    // 立即发送升级命令给在线设备
    const sendResults = await Promise.allSettled(
      tasks.map(async (task) => {
        const unit = units.find(u => u.id === task.unitId);
        if (!unit) return { success: false, reason: 'Unit not found' };

        // 检查设备是否在线
        const isOnline = tcpServer.isDeviceConnected(unit.deviceId);
        if (!isOnline) {
          console.log(`[Firmware] Device ${unit.deviceId} is offline, will send command when it connects`);
          return { success: false, reason: 'Device offline' };
        }

        // 发送升级命令
        const firmwareInfo = {
          version: firmware.version,
          crc32: firmware.crc32,
          size: firmware.fileSize,
          fileName: firmware.fileName
        };

        const sent = await tcpServer.sendUpgradeCommand(unit.deviceId, firmwareInfo);
        if (sent) {
          console.log(`[Firmware] Upgrade command sent to device ${unit.deviceId}`);
          return { success: true, deviceId: unit.deviceId };
        } else {
          console.log(`[Firmware] Failed to send upgrade command to device ${unit.deviceId}`);
          return { success: false, reason: 'Send failed' };
        }
      })
    );

    // 统计发送结果
    const sentCount = sendResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const offlineCount = sendResults.filter(r => r.status === 'fulfilled' && r.value.reason === 'Device offline').length;

    console.log(`[Firmware] Sent upgrade commands: ${sentCount}/${tasks.length}, Offline: ${offlineCount}`);

    res.status(201).json({
      success: true,
      message: `Created ${tasks.length} upgrade tasks`,
      data: {
        taskCount: tasks.length,
        tasks,
        sentCount,
        offlineCount
      }
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

/**
 * 重试升级任务
 * POST /api/firmware/upgrade/:taskId/retry
 */
exports.retryUpgradeTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await UpgradeTask.findByPk(taskId, {
      include: [{ model: FirmwareVersion, as: 'firmware' }]
    });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!['Failed', 'Cancelled'].includes(task.status)) {
      return res.status(400).json({ success: false, message: 'Can only retry Failed or Cancelled tasks' });
    }

    await task.update({ status: 'Pending', errorMessage: null, progress: 0, currentPacket: 0, startedAt: null, completedAt: null });

    // 尝试发送升级命令
    if (task.firmware) {
      try {
        await tcpServer.sendUpgradeCommand(task.deviceId, {
          version: task.firmware.version,
          crc32: task.firmware.crc32,
          size: task.firmware.fileSize,
          fileName: task.firmware.fileName
        });
      } catch (e) {
        console.log(`[Firmware] Device ${task.deviceId} offline, retry task queued`);
      }
    }

    res.json({ success: true, message: 'Task queued for retry' });
  } catch (error) {
    console.error('[Firmware] Retry task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * 删除升级任务
 * DELETE /api/firmware/upgrade/:taskId
 */
exports.deleteUpgradeTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await UpgradeTask.findByPk(taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (['Pending', 'InProgress'].includes(task.status)) {
      return res.status(400).json({ success: false, message: 'Cannot delete active task. Cancel it first.' });
    }

    await task.destroy();
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('[Firmware] Delete task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * 获取设备型号列表
 * GET /api/firmware/device-models
 */
exports.getDeviceModels = async (req, res) => {
  try {
    // 硬编码设备型号列表（根据用户确认）
    const deviceModels = [
      {
        value: 'ATM-ID-1000P',
        label: 'ATM-ID-1000P'
      }
    ];

    res.json({ success: true, data: deviceModels });
  } catch (error) {
    console.error('[Firmware] Get device models error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = exports;
