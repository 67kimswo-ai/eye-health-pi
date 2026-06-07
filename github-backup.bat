@echo off
chcp 65001 >nul
echo.
echo ========================================
echo  아이케어 파이 - GitHub 백업 스크립트
echo  저장소: 67kimswo-ai/eye-health-pi
echo ========================================
echo.

:: 현재 폴더 확인
echo [1단계] 현재 위치: %CD%
echo.

:: Git 초기화
echo [2단계] Git 초기화 중...
git init
git branch -M main
echo.

:: 원격 저장소 연결
echo [3단계] GitHub 저장소 연결 중...
git remote remove origin 2>nul
git remote add origin https://github.com/67kimswo-ai/eye-health-pi.git
echo 연결 완료: https://github.com/67kimswo-ai/eye-health-pi.git
echo.

:: 파일 추가
echo [4단계] 파일 추가 중...
git add .
echo.

:: 커밋
echo [5단계] 커밋 중...
git commit -m "아이케어 파이 초기 백업 - Pi SDK + 시력측정 + Vercel 배포 구조"
echo.

:: 푸시
echo [6단계] GitHub에 업로드 중...
echo (GitHub 로그인 창이 뜨면 로그인해 주세요)
echo.
git push -u origin main
echo.

echo ========================================
echo  백업 완료!
echo  확인: https://github.com/67kimswo-ai/eye-health-pi
echo ========================================
pause
