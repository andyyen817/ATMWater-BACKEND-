@echo off
REM 水站管理系统修复验证脚本 (Windows版本)

echo ================================
echo 水站管理系统修复验证
echo ================================
echo.

REM 检查后端服务是否运行
echo 1. 检查后端服务状态...
curl -s http://localhost:8080/api/auth/request-otp >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 后端服务正在运行
) else (
    echo [ERROR] 后端服务未运行,请先启动: npm start
    exit /b 1
)
echo.

REM 测试email登录接口
echo 2. 测试Email登录接口...
curl -s -X POST http://localhost:8080/api/auth/login-email -H "Content-Type: application/json" -d "{\"email\":\"user1@atmwater.com\",\"password\":\"password123\"}" > temp_login.json
findstr /C:"\"success\":true" temp_login.json >nul
if %errorlevel% equ 0 (
    echo [OK] Email登录接口工作正常
) else (
    echo [ERROR] Email登录失败
    type temp_login.json
)
del temp_login.json
echo.

REM 测试404处理器
echo 3. 测试404 JSON处理器...
curl -s http://localhost:8080/api/nonexistent > temp_404.json
findstr /C:"\"success\":false" temp_404.json >nul
if %errorlevel% equ 0 (
    echo [OK] 404处理器返回JSON格式
) else (
    echo [WARNING] 404处理器可能返回HTML
)
del temp_404.json
echo.

REM 测试新注册的路由
echo 4. 测试新注册的路由...
echo    检查 /api/applications...
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/applications/admin/list > temp_code.txt
set /p APP_CODE=<temp_code.txt
if not "%APP_CODE%"=="404" (
    echo    [OK] /api/applications 路由已注册
) else (
    echo    [ERROR] /api/applications 路由未注册
)

echo    检查 /api/finance...
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/finance/revenue > temp_code.txt
set /p FIN_CODE=<temp_code.txt
if not "%FIN_CODE%"=="404" (
    echo    [OK] /api/finance 路由已注册
) else (
    echo    [ERROR] /api/finance 路由未注册
)

echo    检查 /api/settings...
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/settings > temp_code.txt
set /p SET_CODE=<temp_code.txt
if not "%SET_CODE%"=="404" (
    echo    [OK] /api/settings 路由已注册
) else (
    echo    [ERROR] /api/settings 路由未注册
)
del temp_code.txt
echo.

echo ================================
echo 验证完成!
echo ================================
echo.
echo 下一步:
echo 1. 如果Email登录测试通过,请在Android APP上测试登录
echo 2. 如果路由测试通过,刷新管理后台检查控制台是否还有404错误
echo 3. 执行数据库修复SQL: scripts\fix-device-id.sql
echo.
pause
