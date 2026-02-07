import socket
import json
import time

# ========================================
# TCP 客户端测试脚本
# ========================================

# Zeabur 端口映射：
# 容器端口: 55036 (TCP)
# 外部端口: 30235 (TCP)
# 域名: hkg1.clusters.zeabur.com

HOST = 'hkg1.clusters.zeabur.com'
PORT = 30235  # Zeabur 分配的外部端口

print('========================================')
print('🧪 ATMWater TCP Server Test')
print('========================================\n')

try:
    # 1. 连接服务器
    print(f'[1/5] Connecting to {HOST}:{PORT}...')
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect((HOST, PORT))
    print(f'✅ Connected successfully\n')
    
    # 2. 设备认证
    print('[2/5] Testing device authentication...')
    auth_cmd = {
        "Cmd": "AU",
        "DId": "DEVICE001",
        "Type": "WaterDispenser",
        "Pwd": "pudow"
    }
    sock.send((json.dumps(auth_cmd) + '\n').encode('utf-8'))
    print(f'📤 Sent: {json.dumps(auth_cmd)}')
    
    response = sock.recv(1024).decode('utf-8').strip()
    print(f'📥 Received: {response}')
    
    auth_result = json.loads(response)
    if auth_result.get('Result') == 'OK':
        print('✅ Authentication successful\n')
    else:
        print(f'❌ Authentication failed: {auth_result.get("Msg")}\n')
        sock.close()
        exit(1)
    
    time.sleep(1)
    
    # 3. 心跳测试
    print('[3/5] Testing heartbeat...')
    hb_cmd = {
        "Cmd": "HB",
        "DId": "DEVICE001"
    }
    sock.send((json.dumps(hb_cmd) + '\n').encode('utf-8'))
    print(f'📤 Sent: {json.dumps(hb_cmd)}')
    
    response = sock.recv(1024).decode('utf-8').strip()
    print(f'📥 Received: {response}')
    print('✅ Heartbeat successful\n')
    
    time.sleep(1)
    
    # 4. 刷卡出水（实体卡）
    print('[4/5] Testing swipe water (Physical Card)...')
    sw_cmd = {
        "Cmd": "SW",
        "DId": "DEVICE001",
        "RFID": "RFID001",
        "Vol": "2.5",
        "Price": "500"
    }
    sock.send((json.dumps(sw_cmd) + '\n').encode('utf-8'))
    print(f'📤 Sent: {json.dumps(sw_cmd)}')
    
    response = sock.recv(1024).decode('utf-8').strip()
    print(f'📥 Received: {response}')
    
    sw_result = json.loads(response)
    if sw_result.get('Result') == 'OK':
        print(f'✅ Water dispensed successfully')
        print(f'   Balance: Rp {sw_result.get("Balance")}')
        print(f'   Transaction ID: {sw_result.get("TransactionId")}\n')
    else:
        print(f'❌ Swipe failed: {sw_result.get("Msg")}\n')
    
    time.sleep(1)
    
    # 5. 刷卡出水（虚拟卡）
    print('[5/5] Testing swipe water (Virtual Card)...')
    sw_cmd2 = {
        "Cmd": "SW",
        "DId": "DEVICE001",
        "RFID": "VIRT_081234567890",
        "Vol": "1.5",
        "Price": "500"
    }
    sock.send((json.dumps(sw_cmd2) + '\n').encode('utf-8'))
    print(f'📤 Sent: {json.dumps(sw_cmd2)}')
    
    response = sock.recv(1024).decode('utf-8').strip()
    print(f'📥 Received: {response}')
    
    sw_result2 = json.loads(response)
    if sw_result2.get('Result') == 'OK':
        print(f'✅ Water dispensed successfully')
        print(f'   Balance: Rp {sw_result2.get("Balance")}')
        print(f'   Transaction ID: {sw_result2.get("TransactionId")}\n')
    else:
        print(f'❌ Swipe failed: {sw_result2.get("Msg")}\n')
    
    # 关闭连接
    sock.close()
    
    print('========================================')
    print('✅ All tests completed successfully!')
    print('========================================')
    
except socket.timeout:
    print('❌ Connection timeout - Server may not be running')
except ConnectionRefusedError:
    print('❌ Connection refused - TCP port may not be exposed')
except Exception as e:
    print(f'❌ Error: {e}')
finally:
    try:
        sock.close()
    except:
        pass

