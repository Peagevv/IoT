from flask import Blueprint, jsonify, request
from app.models.car_model import CarModel
from app.models.sensor_model import SensorModel

api_bp = Blueprint('api', __name__)

@api_bp.route('/commands', methods=['GET'])
def get_commands():
    try:
        id_dispositivo = request.args.get('device_id', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        commands = CarModel.get_recent_commands(id_dispositivo, limit)
        return jsonify({'status': 'success', 'data': commands})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@api_bp.route('/obstacles', methods=['GET'])
def get_obstacles():
    try:
        id_dispositivo = request.args.get('device_id', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        obstacles = SensorModel.get_recent_obstacles(id_dispositivo, limit)
        return jsonify({'status': 'success', 'data': obstacles})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@api_bp.route('/operations', methods=['GET'])
def get_operations_catalog():
    try:
        operations = CarModel.get_operations_catalog()
        return jsonify({'status': 'success', 'data': operations})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@api_bp.route('/devices', methods=['GET'])
def get_devices():
    try:
        devices = CarModel.get_devices()
        return jsonify({'status': 'success', 'data': devices})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'IoT Car Backend',
        'version': '1.0.0',
        'database': 'IoT'
    })
@api_bp.route('/obstaculo', methods=['POST'])
def recibir_obstaculo():
    # ✅ SOLO PARA PRUEBAS - IMPRIME Y RESPONDE
    data = request.get_json()
    
    print("🎯 DATOS RECIBIDOS:")
    print(f"Dispositivo: {data.get('id_dispositivo')}")
    print(f"Tipo: {data.get('tipo_obstaculo')}") 
    print(f"Movimiento: {data.get('movimiento_realizado')}")
    print(f"Resultado: {data.get('resultado')}")
    print("---" * 10)
    
    # Respuesta inmediata sin base de datos
    return jsonify({
        "status": "success", 
        "message": "✅ Obstáculo recibido - FUNCIONA!",
        "tus_datos": data
    })