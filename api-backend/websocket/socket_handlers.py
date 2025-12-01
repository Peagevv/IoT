from flask_socketio import SocketIO

# Instancia global de SocketIO
socketio = SocketIO(cors_allowed_origins="*")

def init_socket(app):
    socketio.init_app(app)

    @socketio.on('connect')
    def on_connect():
        print("Cliente WebSocket conectado")

    @socketio.on('disconnect')
    def on_disconnect():
        print("Cliente WebSocket desconectado")
