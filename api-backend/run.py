from app import create_app
from app.config.websocket import socketio
import os

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5500))
    
    # Usar socketio.run en lugar de app.run para WebSocket
    socketio.run(
        app, 
        host='0.0.0.0', 
        port=port, 
        debug=True,
        allow_unsafe_werkzeug=True  # Solo para desarrollo
    )