@echo off
echo ============================================
echo Instalando dependencias del proyecto IoT
echo ============================================

REM Verificar si Python está instalado
python --version
if errorlevel 1 (
    echo ERROR: Python no esta instalado
    echo Descarga Python desde: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Crear entorno virtual si no existe
if not exist "env" (
    echo Creando entorno virtual...
    python -m venv env
)

REM Activar entorno virtual
echo Activando entorno virtual...
call env\Scripts\activate.bat

REM Actualizar pip
echo Actualizando pip...
python -m pip install --upgrade pip

REM Instalar dependencias
echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo ============================================
echo Instalacion completada!
echo ============================================
echo.
echo Ahora ejecuta: python -m app para verificar
pause