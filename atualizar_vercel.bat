@echo off
title Atualizar Site na Vercel (GitHub)
cls
echo ======================================================
echo    ATUALIZANDO SITE NO GITHUB E NA VERCEL
echo ======================================================
echo.
cd /d "%~dp0"
git add .
git commit -m "Atualizacao automatica do site"
echo.
echo Enviando para o GitHub...
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ======================================================
    echo  [SUCESSO] Arquivos enviados para o GitHub!
    echo  A Vercel ja esta atualizando o site automaticamente!
    echo ======================================================
) else (
    echo ======================================================
    echo  [AVISO] Verifique as credenciais do GitHub acima.
    echo ======================================================
)
echo.
pause
