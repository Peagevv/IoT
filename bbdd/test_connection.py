import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

print("🔍 Probando conexión a base de datos IoT...")

try:
    connection = pymysql.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', 'Avec86sdU1@'),
        database=os.getenv('DB_NAME', 'IoT'),
        port=int(os.getenv('DB_PORT', 3306)),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    print("✅ ¡CONEXIÓN EXITOSA a base de datos IoT!")
    
    # Probar consultas
    with connection.cursor() as cursor:
        # Verificar tablas
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print("📋 Tablas en la BD IoT:", [list(table.values())[0] for table in tables])
        
        # Contar registros
        cursor.execute("SELECT COUNT(*) as total FROM historial_operaciones")
        movimientos = cursor.fetchone()
        print(f"📊 Movimientos en historial: {movimientos['total']}")
        
        cursor.execute("SELECT COUNT(*) as total FROM historial_obstaculos")
        obstaculos = cursor.fetchone()
        print(f"🚧 Obstáculos registrados: {obstaculos['total']}")
        
        cursor.execute("SELECT nombre_dispositivo FROM dispositivo")
        dispositivos = cursor.fetchall()
        print("📱 Dispositivos:", [d['nombre_dispositivo'] for d in dispositivos])
    
    connection.close()
    
except pymysql.err.OperationalError as e:
    print(f"❌ Error de conexión: {e}")
    print("\n🔧 Verifica:")
    print("1. Que MySQL esté corriendo")
    print("2. Que la base de datos 'IoT' exista")
    print("3. El password en el archivo .env")
    
except Exception as e:
    print(f"❌ Error inesperado: {e}")