<<<<<<< HEAD
from app import create_app, socketio

# Creamos la app Flask desde la función fábrica
app = create_app()

if __name__ == "__main__":
    print("🚀 Servidor corriendo en http://0.0.0.0:5500 (usando gevent y SocketIO)")
    socketio.run(app, host="0.0.0.0", port=5500, debug=True, allow_unsafe_werkzeug=True)
=======
"""
run.py
Punto de entrada:
- Inicia ws_server.py en un proceso separado (puerto 5501)
- Inicia Flask API en puerto 5500
"""

from app import create_app
import subprocess
import sys
import os
import time

if __name__ == "__main__":
    print("=" * 70)
    print("🚀 INICIANDO SISTEMA IOT CAR")
    print("=" * 70)
    
    # Obtener ruta del ws_server.py
    ws_server_path = os.path.join(os.path.dirname(__file__), 'app', 'config', 'ws_server.py')
    
    # Verificar que existe
    if not os.path.exists(ws_server_path):
        print(f"❌ ERROR: No se encontró ws_server.py en: {ws_server_path}")
        print("   Asegúrate de que app/config/ws_server.py existe")
        sys.exit(1)
    
    # Iniciar ws_server.py en proceso separado
    print("\n🔌 Iniciando WebSocket Server (ws_server.py)...")
    try:
        ws_process = subprocess.Popen(
            [sys.executable, ws_server_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        print("✅ WebSocket Server iniciado en proceso separado")
        print("   - Puerto: 5501")
        print("   - Rutas: /car (Arduino), /client (Web)")
        
        # Dar tiempo para que ws_server inicie
        time.sleep(2)
        
    except Exception as e:
        print(f"❌ ERROR al iniciar WebSocket Server: {e}")
        sys.exit(1)
    
    # Crear app Flask
    print("\n🌐 Iniciando HTTP API Server...")
    app = create_app()
    
    print("✅ HTTP API: http://0.0.0.0:5500")
    print("\n" + "=" * 70)
    print("✨ Sistema listo!")
    print("   - Frontend Control: http://localhost:5500/client_push_post")
    print("   - Frontend Monitor: http://localhost:5500/client-push-get")
    print("   - WebSocket: ws://localhost:5501")
    print("=" * 70 + "\n")
    
    try:
        # Iniciar Flask (bloquea el hilo principal)
        app.run(
            host="0.0.0.0",
            port=5500,
            debug=False,  # Cambiar a False para evitar duplicar procesos
            use_reloader=False
        )
    except KeyboardInterrupt:
        print("\n👋 Deteniendo servidores...")
        ws_process.terminate()
        ws_process.wait()
        print("✅ Servidores detenidos")
    except Exception as e:
        print(f"❌ Error: {e}")
        ws_process.terminate()
        ws_process.wait()
        sys.exit(1)
>>>>>>> f49c8d2 (update apis)
