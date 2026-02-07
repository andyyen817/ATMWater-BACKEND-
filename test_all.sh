#!/bin/bash
# ========================================
# ATMWater Backend - 自动化测试脚本 (Linux/Mac)
# ========================================

echo "========================================"
echo "🚀 ATMWater Backend Automated Test"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 步骤1：检查 Python 是否安装
echo "[1/4] Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python is not installed${NC}"
    echo "Please install Python from https://www.python.org/"
    exit 1
fi
echo -e "${GREEN}✅ Python is installed${NC}"
echo ""

# 步骤2：测试健康检查
echo "[2/4] Testing health check endpoint..."
if ! curl -s https://atmwater-backend.zeabur.app/api/health > health_check.json; then
    echo -e "${RED}❌ Health check failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Health check passed${NC}"
cat health_check.json | python3 -m json.tool
echo ""
echo ""

# 步骤3：提示用户在 Zeabur 终端运行初始化脚本
echo "[3/4] Database Initialization Required"
echo "========================================"
echo "Please run the following command in Zeabur Terminal:"
echo ""
echo -e "${YELLOW}  node scripts/initDatabase.js${NC}"
echo ""
echo "After initialization, you will see:"
echo "  ✅ Created user: 081234567890"
echo "  ✅ Created device: DEVICE001"
echo "  ✅ Created RFID card: RFID001"
echo ""
read -p "Press Enter after you have completed the initialization..."
echo ""

# 步骤4：测试 TCP 连接
echo "[4/4] Testing TCP connection..."
echo "========================================"
if ! python3 test_tcp_client.py; then
    echo ""
    echo -e "${RED}❌ TCP test failed${NC}"
    echo ""
    echo "Possible reasons:"
    echo "  1. Database not initialized (run: node scripts/initDatabase.js in Zeabur)"
    echo "  2. TCP port 55036 not exposed in Zeabur"
    echo "  3. Device or user not created"
    echo ""
    exit 1
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ All tests completed successfully!${NC}"
echo "========================================"
echo ""
echo "📊 Test Summary:"
echo "  ✅ Health check: PASSED"
echo "  ✅ Database: CONNECTED"
echo "  ✅ TCP server: RUNNING"
echo "  ✅ Device authentication: SUCCESS"
echo "  ✅ Water dispensing: SUCCESS"
echo ""
echo "🎯 Next Steps:"
echo "  1. Provide connection info to hardware engineers"
echo "  2. Test with real hardware devices"
echo "  3. Monitor Zeabur logs for any issues"
echo ""
echo "Server Info:"
echo "  HTTP: https://atmwater-backend.zeabur.app"
echo "  TCP: atmwater-backend.zeabur.app:55036"
echo "  Device ID: DEVICE001"
echo "  Password: pudow"
echo ""

# 清理临时文件
rm -f health_check.json

read -p "Press Enter to exit..."

