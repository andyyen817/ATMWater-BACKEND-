#!/bin/bash
# 水站管理系统修复验证脚本

echo "================================"
echo "水站管理系统修复验证"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查后端服务是否运行
echo "1. 检查后端服务状态..."
if curl -s http://localhost:8080/api/auth/request-otp > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务正在运行${NC}"
else
    echo -e "${RED}❌ 后端服务未运行,请先启动: npm start${NC}"
    exit 1
fi
echo ""

# 测试email登录接口
echo "2. 测试Email登录接口..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login-email \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@atmwater.com","password":"password123"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Email登录接口工作正常${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "   获取到Token: ${TOKEN:0:20}..."
else
    echo -e "${RED}❌ Email登录失败${NC}"
    echo "   响应: $LOGIN_RESPONSE"
fi
echo ""

# 测试404处理器
echo "3. 测试404 JSON处理器..."
NOT_FOUND_RESPONSE=$(curl -s http://localhost:8080/api/nonexistent)
if echo "$NOT_FOUND_RESPONSE" | grep -q '"success":false'; then
    echo -e "${GREEN}✅ 404处理器返回JSON格式${NC}"
else
    echo -e "${YELLOW}⚠️  404处理器可能返回HTML${NC}"
fi
echo ""

# 测试新注册的路由
echo "4. 测试新注册的路由..."

# 测试applications路由
APP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/applications/admin/list)
if [ "$APP_RESPONSE" != "404" ]; then
    echo -e "${GREEN}✅ /api/applications 路由已注册${NC}"
else
    echo -e "${RED}❌ /api/applications 路由未注册${NC}"
fi

# 测试finance路由
FIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/finance/revenue)
if [ "$FIN_RESPONSE" != "404" ]; then
    echo -e "${GREEN}✅ /api/finance 路由已注册${NC}"
else
    echo -e "${RED}❌ /api/finance 路由未注册${NC}"
fi

# 测试settings路由
SET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/settings)
if [ "$SET_RESPONSE" != "404" ]; then
    echo -e "${GREEN}✅ /api/settings 路由已注册${NC}"
else
    echo -e "${RED}❌ /api/settings 路由未注册${NC}"
fi
echo ""

# 检查数据库deviceId
echo "5. 检查数据库deviceId (需要MySQL访问权限)..."
echo -e "${YELLOW}请手动执行以下SQL验证:${NC}"
echo "   SELECT device_id, imei, device_name FROM units ORDER BY created_at;"
echo ""

echo "================================"
echo "验证完成!"
echo "================================"
echo ""
echo "下一步:"
echo "1. 如果Email登录测试通过,请在Android APP上测试登录"
echo "2. 如果路由测试通过,刷新管理后台检查控制台是否还有404错误"
echo "3. 执行数据库修复SQL: mysql -u root -p zeabur < scripts/fix-device-id.sql"
echo ""
