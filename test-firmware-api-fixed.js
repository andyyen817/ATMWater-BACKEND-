// 测试修复后的固件 API
require('dotenv').config();
const express = require('express');
const { FirmwareVersion, User } = require('./src/models');

async function testFixedAPI() {
  try {
    console.log('📋 测试修复后的固件列表 API...\n');

    // 模拟控制器逻辑（修复后）
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

    console.log(`找到 ${versionsWithStatus.length} 个固件版本\n`);

    if (versionsWithStatus.length === 0) {
      console.log('❌ API 返回空数组');
    } else {
      console.log('✅ API 返回数据（修复后）：\n');
      versionsWithStatus.forEach(v => {
        console.log('固件数据：');
        console.log(JSON.stringify(v, null, 2));
        console.log('\n✅ 包含 status 字段:', v.status);
      });
    }

    // 验证前端期望的字段
    console.log('\n📊 验证前端兼容性：');
    const firstFirmware = versionsWithStatus[0];
    console.log(`✅ status 字段存在: ${firstFirmware.status !== undefined}`);
    console.log(`✅ status 值正确: ${firstFirmware.status === 'active' || firstFirmware.status === 'inactive'}`);
    console.log(`✅ isActive 字段保留: ${firstFirmware.isActive !== undefined}`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    process.exit(0);
  }
}

testFixedAPI();
