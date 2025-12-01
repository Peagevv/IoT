"""
app/__init__.py
Inicialización de la aplicación Flask con WebSocket
"""

from flask import Flask
from flask_cors import CORS
from app.config.database import init_db
import os
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # ===============================
    # CORS GLOBAL
    # ===============================
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
    
    # ===============================
    # Configuración
    # ===============================
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    
    # ===============================
    # Inicializar base de datos
    # ===============================
    init_db(app)
    
    # ===============================
    # ✅ IMPORTAR Y REGISTRAR BLUEPRINT CON PREFIX FORZADO
    # ===============================
    from app.routes.api_routes import api_bp
    
    # Forzar el url_prefix en el registro
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # ===============================
    # Ruta raíz para verificar que funciona
    # ===============================
    @app.route('/')
    def index():
        return {
            'status': 'online',
            'service': 'IoT Car API',
            'version': '1.0.0',
            'endpoints': {
                'health': '/api/health',
                'commands': '/api/commands',
                'obstacles': '/api/obstacles',
                'sequences': '/api/sequences',
                'devices': '/api/devices',
                'velocidades': '/api/velocidades'
            }
        }
    
    return app