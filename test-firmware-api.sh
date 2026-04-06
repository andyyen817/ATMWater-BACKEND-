#!/bin/bash

# 固件部署 API 测试脚本
# 用于验证 Zeabur 上的 /api/firmware/upgrade 端点是否可用

BASE_URL="https://atmwater-backend.zeabur.app"
PHONE="081234567891"
PASSWORD="admin123"

echo "=========================================="
echo "固件部署 API 测试"
echo "=========================================="
echo ""

# 步骤 1: 登录获取 token
echo "[1/4] 正在登录获取 token..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login-password" \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"${PHONE}\",\"password\":\"${PASSWORD}\"}")

echo "登录响应: ${LOGIN_RESPONSE}"
echo ""

# 提取 token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取 token"
  echo "请检查账号密码是否正确"
  exit 1
fi

echo "✅ 登录成功"
echo "Token: ${TOKEN:0:20}..."
echo ""

# 步骤 2: 获取固件列表
echo "[2/4] 正在获取固件列表..."
FIRMWARE_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/firmware/list" \
  -H "Authorization: Bearer ${TOKEN}")

echo "固件列表响应: ${FIRMWARE_RESPONSE}"
echo ""

# 步骤 3: 获取设备列表
echo "[3/4] 正在获取设备列表..."
UNITS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/units" \
  -H "Authorization: Bearer ${TOKEN}")

echo "设备列表响应: ${UNITS_RESPONSE}"
echo ""

# 步骤 4: 测试 /api/firmware/upgrade 端点
echo "[4/4] 测试 /api/firmware/upgrade 端点..."
echo ""

echo "测试 A: POST /api/firmware/upgrade (前端使用的端点)"
UPGRADE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}/api/firmware/upgrade" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"firmwareId": 1, "unitIds": ["898608311123900885420001"]}')

HTTP_STATUS=$(echo "$UPGRADE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$UPGRADE_RESPONSE" | sed '/HTTP_STATUS/d')

echo "状态码: ${HTTP_STATUS}"
echo "响应体: ${RESPONSE_BODY}"
echo ""

if [ "$HTTP_STATUS" = "404" ]; then
  echo "❌ /api/firmware/upgrade 返回 404 - 路由不存在"
  echo ""

  echo "测试 B: POST /api/firmware/upgrade/batch (备用端点)"
  BATCH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}/api/firmware/upgrade/batch" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"firmwareVersionId": 1, "deviceIds": ["898608311123900885420001"]}')

  BATCH_STATUS=$(echo "$BATCH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
  BATCH_BODY=$(echo "$BATCH_RESPONSE" | sed '/HTTP_STATUS/d')

  echo "状态码: ${BATCH_STATUS}"
  echo "响应体: ${BATCH_BODY}"
  echo ""

  if [ "$BATCH_STATUS" = "201" ] || [ "$BATCH_STATUS" = "200" ]; then
    echo "✅ /api/firmware/upgrade/batch 可用"
    echo ""
    echo "=========================================="
    echo "诊断结果"
    echo "=========================================="
    echo "问题: /api/firmware/upgrade 路由未在 Zeabur 上生效"
    echo "原因: Zeabur 可能部署了旧版本代码"
    echo ""
    echo "解决方案:"
    echo "1. 在 Zeabur Dashboard 强制重新部署"
    echo "2. 或者修改前端使用 /api/firmware/upgrade/batch 端点"
  else
    echo "❌ /api/firmware/upgrade/batch 也失败"
    echo "需要检查后端代码和 Zeabur 部署配置"
  fi
elif [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ /api/firmware/upgrade 可用"
  echo ""
  echo "=========================================="
  echo "诊断结果"
  echo "=========================================="
  echo "API 端点正常工作，问题可能在前端"
  echo "请检查前端的 API 调用配置"
else
  echo "⚠️  返回状态码: ${HTTP_STATUS}"
  echo "需要进一步分析响应内容"
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
