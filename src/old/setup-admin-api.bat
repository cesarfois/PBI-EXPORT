@echo off
echo ==========================================
echo Configurando API Key ADMINISTRATIVA
echo ==========================================
echo.

REM Atualizar arquivo .env.local com a API Key ADMINISTRATIVA
(
echo # DocuWare Power Automate API Key for Workflow Analytics
echo # IMPORTANT: This file is ignored by Git - never commit API keys to the repository
echo VITE_DOCUWARE_ADMIN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJndWlkIjoiNjg0ZTU3ZmYtZmI5Yy00YjAyLTg3YjQtOThkYTE0NzZhYjgzIiwicmVnaW9uIjoiRU1FQSIsIm5iZiI6MTc2NTkwNDI1NCwiZXhwIjoxNzY1OTA3ODU0LCJpYXQiOjE3NjU5MDQyNTQsImlzcyI6IkRvY3VXYXJlIn0.2UiorYxkRFEqIWCtIYDAJXVTKHZYywvF0Q6PtjFw3Sw
echo VITE_DOCUWARE_ADMIN_URL=https://rcsangola.docuware.cloud
) > .env.local

echo [OK] Arquivo .env.local atualizado com Admin API Key!
echo.
echo IMPORTANTE: Reinicie o servidor Vite para aplicar as mudancas!
echo            Pressione Ctrl+C no terminal do Vite e rode "npm run dev" novamente
echo.
pause
