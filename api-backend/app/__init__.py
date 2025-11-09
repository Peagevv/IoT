from flask import Flask
from flask_cors import CORS
from app.config.database import init_db
from app.config.websocket import socketio
from app.routes.api_routes import api_bp

def create_app():
    app = Flask(__name__)
    
    # Configuración CORS para permitir peticiones desde el frontend
    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Configuración de Flask
    app.config['SECRET_KEY'] = 'tu_clave_secreta_aqui_cambiar_en_produccion'
    
    # Inicializar base de datos
    init_db(app)
    
    # Inicializar SocketIO
    socketio.init_app(app)
    
    # Registrar blueprints
    app.register_blueprint(api_bp, url_prefix='/api')
    
    return app