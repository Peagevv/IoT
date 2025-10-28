from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from .config.database import init_db
from .routes.api_routes import api_bp
import os
from dotenv import load_dotenv

# Cargar variables del archivo .env
load_dotenv()

socketio = SocketIO()

def create_app():
    app = Flask(__name__)
    
    # Configuración desde .env
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'iot-car-secret-key')
    
    # CORS para aceptar cualquier IP pública
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Inicializar base de datos
    init_db(app)
    
    # Registrar blueprints (rutas)
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # Inicializar WebSockets
    socketio.init_app(app, cors_allowed_origins="*")
    
    # Importar y registrar eventos de WebSocket
    from .controllers import car_controller
    from .controllers import sensor_controller
    
    return app