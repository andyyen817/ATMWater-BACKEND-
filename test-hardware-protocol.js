// ========================================
// 硬件协议测试脚本
// ========================================
// 用于测试所有硬件IOT通讯协议指令
// 运行方式: node test-hardware-protocol.js

const net = require('net');

// 配置
const TCP_HOST = process.env.TCP_HOST || 'localhost';
const TCP_PORT = process.env.TCP_PORT || 55036;

// 测试数据
const TEST_DEVICE_ID = 'DEVICE001';
const TEST_RFID = 'VIRT_081234567890';
const TEST_PASSWORD = 'pudow';
const TEST_VERSION = 'V1.0.0';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message, data = null) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// ========================================
// TCP客户端
// ========================================
class HardwareClient {
  constructor() {
    this.client = null;
    this.buffer = '';
    this.testResults = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = net.connect({
        host: TCP_HOST,
        port: TCP_PORT
      }, () => {
        log(colors.green, '✅', `Connected to ${TCP_HOST}:${TCP_PORT}`);
        resolve();
      });

      this.client.on('data', (data) => {
        this.buffer += data.toString();
        const messages = this.buffer.split('\n');
        this.buffer = messages.pop();

        messages.forEach(msg => {
          if (msg.trim()) {
            try {
              const response = JSON.parse(msg);
              log(colors.cyan, '📥', 'Received:', response);
            } catch (error) {
              log(colors.red, '❌', 'Parse error:', msg);
            }
          }
        });
      });

      this.client.on('error', (error) => {
        log(colors.red, '❌', 'Connection error:', error.message);
        reject(error);
      });

      this.client.on('close', () => {
        log(colors.yellow, '🔌', 'Connection closed');
      });
    });
  }

  send(cmd) {
    return new Promise((resolve) => {
      const message = JSON.stringify(cmd) + '\n';
      this.client.write(message);
      log(colors.blue, '📤', 'Sent:', cmd);

      // 等待响应
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  }

  close() {
    if (this.client) {
      this.client.end();
    }
  }
}

// ========================================
// 测试用例
// ========================================
async function runTests() {
  const client = new HardwareClient();

  try {
    await client.connect();

    log(colors.yellow, '🧪', '========================================');
    log(colors.yellow, '🧪', 'Starting Hardware Protocol Tests');
    log(colors.yellow, '🧪', '========================================\n');

    // 测试1: AU - 设备认证
    log(colors.yellow, '🧪', 'Test 1: AU - Device Authentication');
    await client.send({
      Cmd: 'AU',
      DId: TEST_DEVICE_ID,
      Type: 'WaterDispenser',
      Pwd: TEST_PASSWORD,
      Ver: TEST_VERSION
    });
    await sleep(2000);

    // 测试2: HB - 心跳（无告警）
    log(colors.yellow, '🧪', '\nTest 2: HB - Heartbeat (No Errors)');
    await client.send({
      Cmd: 'HB',
      DId: TEST_DEVICE_ID
    });
    await sleep(2000);

    // 测试3: HB - 心跳（带告警）
    log(colors.yellow, '🧪', '\nTest 3: HB - Heartbeat (With Errors)');
    await client.send({
      Cmd: 'HB',
      DId: TEST_DEVICE_ID,
      Errs: ['MakeWaterLong', 'Press_Out_Err']
    });
    await sleep(2000);

    // 测试4: WR - 用水数据记录上报
    log(colors.yellow, '🧪', '\nTest 4: WR - Water Record Report');
    await client.send({
      Cmd: 'WR',
      DId: TEST_DEVICE_ID,
      TE: Date.now().toString(),
      RFID: TEST_RFID,
      PWM: '1000',  // 1000脉冲
      Money: '5000',  // 5000印尼盾
      FT: '120',  // 120秒
      Tds: '15',  // 纯水TDS
      IDS: '200',  // 进水TDS
      RE: 'REC001',  // 记录ID
      Tmp: '25'  // 温度25度
    });
    await sleep(2000);

    // 测试5: Mk - 制水记录
    log(colors.yellow, '🧪', '\nTest 5: Mk - Make Water Record');
    await client.send({
      Cmd: 'Mk',
      DId: TEST_DEVICE_ID,
      FT: '300',  // 制水时间300秒
      PWM: '5000',  // 脉冲数
      TDS: '12',  // 纯水TDS
      IDS: '180',  // 进水TDS
      RC: 'MK001'  // 记录编号
    });
    await sleep(2000);

    // 测试6: AddMoney - 充值命令
    log(colors.yellow, '🧪', '\nTest 6: AddMoney - Top Up');
    await client.send({
      Cmd: 'AddMoney',
      RFID: TEST_RFID,
      RE: 'TOP001',
      LeftL: '-1',
      LeftM: '10000'  // 充值10000印尼盾
    });
    await sleep(2000);

    // 测试7: OpenWater - 扫码放水
    log(colors.yellow, '🧪', '\nTest 7: OpenWater - QR Code Water Dispensing');
    await client.send({
      Cmd: 'OpenWater',
      RFID: 'w' + TEST_RFID,  // 虚拟账户以'w'开头
      Money: '3000',
      PWM: '600',
      Type: 'RO',
      RE: 'QR001'
    });
    await sleep(2000);

    // 测试8: DS - 设备状态上报
    log(colors.yellow, '🧪', '\nTest 8: DS - Device Status Report');
    await client.send({
      Cmd: 'DS',
      DId: TEST_DEVICE_ID,
      Status: 'Online',
      ErrorCode: null
    });
    await sleep(2000);

    // 测试9: WQ - 水质数据上报
    log(colors.yellow, '🧪', '\nTest 9: WQ - Water Quality Report');
    await client.send({
      Cmd: 'WQ',
      DId: TEST_DEVICE_ID,
      TDS: 18,
      Temp: 26.5
    });
    await sleep(2000);

    // 测试10: SW - 刷卡出水（兼容旧系统）
    log(colors.yellow, '🧪', '\nTest 10: SW - Swipe Card (Legacy)');
    await client.send({
      Cmd: 'SW',
      DId: TEST_DEVICE_ID,
      RFID: TEST_RFID,
      Vol: 10.5,
      Price: 500
    });
    await sleep(2000);

    log(colors.yellow, '🧪', '\n========================================');
    log(colors.green, '✅', 'All tests completed!');
    log(colors.yellow, '🧪', '========================================');

  } catch (error) {
    log(colors.red, '❌', 'Test failed:', error.message);
  } finally {
    client.close();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// 运行测试
// ========================================
console.log('\n');
log(colors.cyan, '🚀', '========================================');
log(colors.cyan, '🚀', 'Hardware Protocol Test Suite');
log(colors.cyan, '🚀', '========================================');
log(colors.cyan, '📋', `Target: ${TCP_HOST}:${TCP_PORT}`);
log(colors.cyan, '📋', `Device ID: ${TEST_DEVICE_ID}`);
log(colors.cyan, '📋', `Test RFID: ${TEST_RFID}`);
log(colors.cyan, '🚀', '========================================\n');

runTests().catch(error => {
  log(colors.red, '❌', 'Fatal error:', error.message);
  process.exit(1);
});
