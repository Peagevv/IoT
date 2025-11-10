from app import create_app, socketio

# Creamos la app Flask desde la función fábrica
app = create_app()

if __name__ == "__main__":
    print("🚀 Servidor corriendo en http://0.0.0.0:5500 (usando gevent y SocketIO)")
    socketio.run(app, host="0.0.0.0", port=5500, debug=True, allow_unsafe_werkzeug=True)
