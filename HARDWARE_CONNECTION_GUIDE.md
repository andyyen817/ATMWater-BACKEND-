# ========================================
# ATMWater Backend - 硬件设备连接指南
# ========================================

## 🎯 重要提示

### TCP 端口映射说明

Zeabur 云平台的端口映射配置：

```
容器内部端口: 55036 (服务器监听端口)
         ↓
    Zeabur 端口映射
         ↓
外部公网端口: 30235 (硬件设备连接端口)
```

**这是正常的！** 服务器在容器内监听 `55036` 端口，但 Zeabur 将其映射到外部的 `30235` 端口。

---

## 📡 硬件设备连接参数

### ✅ 正确的连接方式

```yaml
# 生产环境（Zeabur）
服务器地址: hkg1.clusters.zeabur.com
TCP 端口: 30235  # ⚠️ 使用外部端口，不是 55036
协议: TCP 长连接
数据格式: JSON (每条消息以 \n 结尾)
字符编码: UTF-8
心跳间隔: 60秒
超时时间: 120秒
```

### ❌ 错误的连接方式

```yaml
# ❌ 不要使用这个
服务器地址: atmwater-backend.zeabur.app
TCP 端口: 55036  # ❌ 这是容器内部端口，外部无法访问
```

---

## 🔧 ESP32/Arduino 示例代码

### ESP32 (Arduino IDE)

```cpp
#include <WiFi.h>

// WiFi 配置
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// TCP 服务器配置
const char* tcpServer = "hkg1.clusters.zeabur.com";
const int tcpPort = 30235;  // ⚠️ 使用外部端口 30235

// 设备信息
const char* deviceId = "DEVICE001";
const char* devicePassword = "pudow";

WiFiClient client;

void setup() {
  Serial.begin(115200);
  
  // 连接 WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // 连接 TCP 服务器
  connectToServer();
  
  // 发送设备认证
  authenticateDevice();
}

void loop() {
  // 检查连接
  if (!client.connected()) {
    Serial.println("Disconnected, reconnecting...");
    connectToServer();
    authenticateDevice();
  }
  
  // 接收服务器消息
  if (client.available()) {
    String response = client.readStringUntil('\n');
    Serial.println("Received: " + response);
    handleResponse(response);
  }
  
  // 每60秒发送心跳
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 60000) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  delay(100);
}

void connectToServer() {
  Serial.println("Connecting to TCP server...");
  if (client.connect(tcpServer, tcpPort)) {
    Serial.println("Connected to server");
  } else {
    Serial.println("Connection failed");
    delay(5000);
  }
}

void authenticateDevice() {
  String authCmd = "{\"Cmd\":\"AU\",\"DId\":\"" + String(deviceId) + 
                   "\",\"Type\":\"WaterDispenser\",\"Pwd\":\"" + 
                   String(devicePassword) + "\"}\n";
  client.print(authCmd);
  Serial.println("Sent: " + authCmd);
}

void sendHeartbeat() {
  String hbCmd = "{\"Cmd\":\"HB\",\"DId\":\"" + String(deviceId) + "\"}\n";
  client.print(hbCmd);
  Serial.println("Sent heartbeat");
}

void sendSwipeWater(String rfid, float volume, float price) {
  String swCmd = "{\"Cmd\":\"SW\",\"DId\":\"" + String(deviceId) + 
                 "\",\"RFID\":\"" + rfid + 
                 "\",\"Vol\":\"" + String(volume) + 
                 "\",\"Price\":\"" + String(price) + "\"}\n";
  client.print(swCmd);
  Serial.println("Sent: " + swCmd);
}

void handleResponse(String response) {
  // 解析 JSON 响应
  // 这里需要使用 ArduinoJson 库
  // 示例：检查是否认证成功
  if (response.indexOf("\"Result\":\"OK\"") > 0) {
    Serial.println("Command successful");
  } else {
    Serial.println("Command failed");
  }
}
```

---

## 🐍 Python 测试脚本

```python
import socket
import json
import time

# TCP 服务器配置
HOST = 'hkg1.clusters.zeabur.com'
PORT = 30235  # ⚠️ 使用外部端口 30235

# 设备信息
DEVICE_ID = 'DEVICE001'
DEVICE_PASSWORD = 'pudow'

def connect_to_server():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect((HOST, PORT))
    print(f'✅ Connected to {HOST}:{PORT}')
    return sock

def send_command(sock, cmd):
    message = json.dumps(cmd) + '\n'
    sock.sendall(message.encode('utf-8'))
    print(f'📤 Sent: {cmd}')
    
    response = sock.recv(4096).decode('utf-8').strip()
    response_json = json.loads(response)
    print(f'📥 Received: {response_json}')
    return response_json

def authenticate(sock):
    cmd = {
        "Cmd": "AU",
        "DId": DEVICE_ID,
        "Type": "WaterDispenser",
        "Pwd": DEVICE_PASSWORD
    }
    return send_command(sock, cmd)

def send_heartbeat(sock):
    cmd = {
        "Cmd": "HB",
        "DId": DEVICE_ID
    }
    return send_command(sock, cmd)

def swipe_water(sock, rfid, volume, price):
    cmd = {
        "Cmd": "SW",
        "DId": DEVICE_ID,
        "RFID": rfid,
        "Vol": str(volume),
        "Price": str(price)
    }
    return send_command(sock, cmd)

# 主程序
if __name__ == '__main__':
    try:
        # 连接服务器
        sock = connect_to_server()
        
        # 设备认证
        auth_result = authenticate(sock)
        if auth_result['Result'] == 'OK':
            print('✅ Authentication successful')
        
        # 发送心跳
        send_heartbeat(sock)
        
        # 刷卡出水
        swipe_result = swipe_water(sock, 'RFID001', 2.5, 500)
        if swipe_result['Result'] == 'OK':
            print(f'✅ Water dispensed, Balance: {swipe_result["Balance"]}')
        
        sock.close()
        
    except Exception as e:
        print(f'❌ Error: {e}')
```

---

## 📊 端口映射详解

### 为什么需要端口映射？

```
┌─────────────────────────────────────────────────┐
│              硬件设备 (ESP32)                    │
│                                                 │
│  WiFi.connect("hkg1.clusters.zeabur.com", 30235)│
└─────────────────┬───────────────────────────────┘
                  │
                  │ 公网访问
                  │ 端口: 30235
                  ↓
┌─────────────────────────────────────────────────┐
│           Zeabur 云平台 (防火墙/路由)            │
│                                                 │
│  端口映射规则:                                   │
│  外部端口 30235 → 容器端口 55036                 │
└─────────────────┬───────────────────────────────┘
                  │
                  │ 内部转发
                  │ 端口: 55036
                  ↓
┌─────────────────────────────────────────────────┐
│         Docker 容器 (ATMWater Backend)          │
│                                                 │
│  server.listen(55036, '0.0.0.0')                │
│  [TCP] ✅ Server listening on port 55036        │
└─────────────────────────────────────────────────┘
```

### 类似的例子

这就像你家的路由器端口转发：

```
外网访问: 你的公网IP:8080
    ↓
路由器端口转发
    ↓
内网设备: 192.168.1.100:80
```

---

## 🧪 测试连接

### 方法1：使用 telnet

```bash
telnet hkg1.clusters.zeabur.com 30235
```

如果连接成功，会显示：
```
Trying [IP]...
Connected to hkg1.clusters.zeabur.com.
```

### 方法2：使用 nc (netcat)

```bash
nc -zv hkg1.clusters.zeabur.com 30235
```

### 方法3：使用 Python

```python
import socket

try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    result = sock.connect_ex(('hkg1.clusters.zeabur.com', 30235))
    if result == 0:
        print("✅ Port 30235 is open")
    else:
        print("❌ Port 30235 is closed")
    sock.close()
except Exception as e:
    print(f"❌ Error: {e}")
```

---

## 📋 常见问题

### Q1: 为什么不能直接连接 55036 端口？

**A**: `55036` 是容器内部端口，只在 Docker 容器内部可见。外部设备必须通过 Zeabur 分配的外部端口 `30235` 访问。

### Q2: 为什么测试页面显示的是 55036？

**A**: 测试页面显示的是服务器监听的端口（容器内部端口）。这是为了让开发者知道服务器配置。但硬件设备必须使用外部端口 `30235`。

### Q3: 如果我想使用 55036 端口怎么办？

**A**: 你可以在 Zeabur 控制台配置端口映射，将外部端口也设置为 55036：
```
外部端口: 55036 → 容器端口: 55036
```

但目前的配置是：
```
外部端口: 30235 → 容器端口: 55036
```

### Q4: 我可以同时使用多个外部端口吗？

**A**: 可以！你可以在 Zeabur 添加多个端口映射，例如：
```
外部端口: 30235 → 容器端口: 55036
外部端口: 55036 → 容器端口: 55036
```

---

## 🎯 总结

### ✅ 正确的连接信息

```yaml
# 硬件设备连接参数
服务器地址: hkg1.clusters.zeabur.com
TCP 端口: 30235  # ⚠️ 重要：使用外部端口
协议: TCP
数据格式: JSON + \n

# 设备认证
设备ID: DEVICE001
密码: pudow

# 测试RFID
实体卡: RFID001
虚拟卡: VIRT_081234567890
```

### 📊 端口对照表

| 位置 | 端口 | 说明 |
|------|------|------|
| **硬件设备连接** | `30235` | ✅ 使用这个 |
| **Zeabur 外部端口** | `30235` | 公网访问端口 |
| **Zeabur 容器端口** | `55036` | 内部映射端口 |
| **服务器监听端口** | `55036` | 代码中的端口 |

### 🔑 关键点

1. **硬件设备必须连接到 `hkg1.clusters.zeabur.com:30235`**
2. 服务器在容器内监听 `55036` 是正常的
3. Zeabur 自动处理端口映射 `30235 → 55036`
4. 测试页面显示 `55036` 是为了显示服务器配置，不是连接端口

---

## 📞 需要帮助？

如果硬件设备连接失败，请检查：

1. ✅ 使用的是 `hkg1.clusters.zeabur.com:30235`（不是 55036）
2. ✅ 网络连接正常
3. ✅ 防火墙没有阻止连接
4. ✅ 设备ID和密码正确

---

**记住：硬件设备连接 `hkg1.clusters.zeabur.com:30235`，不是 55036！** 🚀

