@echo off
REM ========================================
REM ATMWater Backend - 自动化测试脚本
REM ========================================

echo ========================================
echo 🚀 ATMWater Backend Automated Test
echo ========================================
echo.

REM 设置颜色（Windows 10+）
color 0A

REM 步骤1：检查 Python 是否安装
echo [1/4] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)
echo ✅ Python is installed
echo.

REM 步骤2：测试健康检查
echo [2/4] Testing health check endpoint...
curl -s https://atmwater-backend.zeabur.app/api/health > health_check.json
if %errorlevel% neq 0 (
    echo ❌ Health check failed
    pause
    exit /b 1
)
echo ✅ Health check passed
type health_check.json
echo.
echo.

REM 步骤3：提示用户在 Zeabur 终端运行初始化脚本
echo [3/4] Database Initialization Required
echo ========================================
echo Please run the following command in Zeabur Terminal:
echo.
echo   node scripts/initDatabase.js
echo.
echo After initialization, you will see:
echo   ✅ Created user: 081234567890
echo   ✅ Created device: DEVICE001
echo   ✅ Created RFID card: RFID001
echo.
echo Press any key after you have completed the initialization...
pause >nul
echo.

REM 步骤4：测试 TCP 连接
echo [4/4] Testing TCP connection...
echo ========================================
python test_tcp_client.py
if %errorlevel% neq 0 (
    echo.
    echo ❌ TCP test failed
    echo.
    echo Possible reasons:
    echo   1. Database not initialized (run: node scripts/initDatabase.js in Zeabur)
    echo   2. TCP port 55036 not exposed in Zeabur
    echo   3. Device or user not created
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ All tests completed successfully!
echo ========================================
echo.
echo 📊 Test Summary:
echo   ✅ Health check: PASSED
echo   ✅ Database: CONNECTED
echo   ✅ TCP server: RUNNING
echo   ✅ Device authentication: SUCCESS
echo   ✅ Water dispensing: SUCCESS
echo.
echo 🎯 Next Steps:
echo   1. Provide connection info to hardware engineers
echo   2. Test with real hardware devices
echo   3. Monitor Zeabur logs for any issues
echo.
echo Server Info:
echo   HTTP: https://atmwater-backend.zeabur.app
echo   TCP: atmwater-backend.zeabur.app:55036
echo   Device ID: DEVICE001
echo   Password: pudow
echo.

REM 清理临时文件
del health_check.json >nul 2>&1

pause

