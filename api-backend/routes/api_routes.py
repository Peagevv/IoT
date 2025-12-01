from flask import Blueprint, jsonify, request, make_response
from app.controllers.car_controller import CarController
from app.controllers.sensor_controller import SensorController
from app.controllers.sequence_controller import SequenceController
from app.controllers.velocidad_controller import VelocidadController
from app.models.car_model import CarModel
from app.models.sensor_model import SensorModel
from app.models.sequence_model import SequenceModel
from app.models.velocidad_model import VelocidadModel
from datetime import datetime

api_bp = Blueprint('api', __name__, url_prefix='/api')

# Función auxiliar para convertir datetime a string
def serialize_datetime(data):
    """Convierte objetos datetime a string para JSON"""
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                result[key] = value.strftime('%Y-%m-%d %H:%M:%S')
            elif isinstance(value, dict):
                result[key] = serialize_datetime(value)
            elif isinstance(value, list):
                result[key] = [serialize_datetime(item) if isinstance(item, dict) else item for item in value]
            else:
                result[key] = value
        return result
    return data

# ==================== HEALTH CHECK ====================
@api_bp.route('/health', methods=['GET'])
def health_check():
    """Verificar estado del servidor"""
    return jsonify({
        'status': 'healthy',
        'service': 'IoT Car Backend',
        'version': '1.0.0',
        'database': 'IoT'
    })

# ==================== COMANDOS/CONTROL ====================
@api_bp.route('/commands', methods=['GET'])
def get_commands():
    """Obtener historial de comandos"""
    return CarController.get_recent_commands()

@api_bp.route('/commands', methods=['POST'])
def send_command():
    """Enviar comando al carrito"""
    response = CarController.send_command()
    # ✅ Las notificaciones WebSocket las maneja ws_server.py automáticamente
    # Ya NO necesitamos emit_data_update() aquí
    return response

@api_bp.route('/operations', methods=['GET'])
def get_operations():
    """Obtener catálogo de operaciones"""
    return CarController.get_operations_catalog()

# ==================== SENSORES/OBSTÁCULOS ====================
@api_bp.route('/obstacles', methods=['GET'])
def get_obstacles():
    """Obtener historial de obstáculos"""
    return SensorController.get_recent_obstacles()

@api_bp.route('/obstacles', methods=['POST'])
def report_obstacle():
    """Reportar obstáculo detectado"""
    response = SensorController.report_obstacle()
    # ✅ ws_server.py maneja las notificaciones
    return response

@api_bp.route('/obstacles/catalog', methods=['GET'])
def get_obstacles_catalog():
    """Obtener catálogo de tipos de obstáculos"""
    return SensorController.get_obstacles_catalog()

# ==================== OBSTÁCULOS MANUALES ====================
@api_bp.route('/obstacles/manual', methods=['POST'])
def create_manual_obstacle():
    """Crear obstáculo manual"""
    response = SensorController.create_manual_obstacle()
    # ✅ ws_server.py maneja las notificaciones
    return response

@api_bp.route('/obstacles/manual', methods=['GET'])
def get_manual_obstacles():
    """Obtener obstáculos manuales recientes"""
    return SensorController.get_manual_obstacles()

@api_bp.route('/obstacles/manual/<int:obstacle_id>', methods=['DELETE'])
def delete_manual_obstacle(obstacle_id):
    """Eliminar obstáculo manual"""
    response = SensorController.delete_manual_obstacle(obstacle_id)
    # ✅ ws_server.py maneja las notificaciones
    return response

# ==================== SECUENCIAS DEMO ====================
@api_bp.route('/sequences', methods=['GET'])
def get_sequences():
    """Obtener lista de secuencias"""
    return SequenceController.get_sequences()

@api_bp.route('/sequences', methods=['POST'])
def create_sequence():
    """Crear nueva secuencia"""
    response = SequenceController.create_sequence()
    # ✅ ws_server.py maneja las notificaciones
    return response

@api_bp.route('/sequences/<int:id_secuencia>', methods=['GET'])
def get_sequence(id_secuencia):
    """Obtener una secuencia específica"""
    return SequenceController.get_sequence_by_id(id_secuencia)

@api_bp.route('/sequences/<int:id_secuencia>', methods=['PUT'])
def update_sequence(id_secuencia):
    """Actualizar una secuencia"""
    response = SequenceController.update_sequence(id_secuencia)
    # ✅ ws_server.py maneja las notificaciones
    return response

@api_bp.route('/sequences/<int:id_secuencia>', methods=['DELETE'])
def delete_sequence(id_secuencia):
    """Eliminar una secuencia"""
    response = SequenceController.delete_sequence(id_secuencia)
    # ✅ ws_server.py maneja las notificaciones
    return response

@api_bp.route('/sequences/<int:id_secuencia>/execute', methods=['POST'])
def execute_sequence(id_secuencia):
    """Ejecutar una secuencia"""
    response = SequenceController.execute_sequence(id_secuencia)
    # ✅ ws_server.py maneja las notificaciones
    return response

@api_bp.route('/sequences/execution/status', methods=['PUT'])
def update_execution_status():
    """Actualizar estado de ejecución"""
    response = SequenceController.update_execution_status()
    # ✅ ws_server.py maneja las notificaciones
    return response

# ==================== DISPOSITIVOS ====================
@api_bp.route('/devices', methods=['GET'])
def get_devices():
    """Obtener lista de dispositivos"""
    return CarController.get_devices()

@api_bp.route('/devices', methods=['POST'])
def create_device():
    """Crear nuevo dispositivo"""
    response = CarController.create_device()
    # ✅ ws_server.py maneja las notificaciones
    return response

@api_bp.route('/devices/<int:device_id>', methods=['PUT'])
def update_device(device_id):
    """Actualizar dispositivo"""
    response = CarController.update_device(device_id)
    # ✅ ws_server.py maneja las notificaciones
    return response

@api_bp.route('/devices/<int:device_id>', methods=['DELETE'])
def delete_device(device_id):
    """Eliminar dispositivo"""
    response = CarController.delete_device(device_id)
    # ✅ ws_server.py maneja las notificaciones
    return response

# ==================== ESTADO DEL DISPOSITIVO ====================
@api_bp.route('/devices/<int:device_id>/status', methods=['GET'])
def get_device_status(device_id):
    """Obtener el último estado de un dispositivo"""
    try:
        last_command = CarModel.get_recent_commands(device_id, 1)
        last_obstacle = SensorModel.get_recent_obstacles(device_id, 1)
        
        status_data = {
            'last_command': last_command[0] if last_command else None,
            'last_obstacle': last_obstacle[0] if last_obstacle else None,
            'current_status': 'online',
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify({
            'status': 'success',
            'data': status_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error al obtener estado: {str(e)}'
        }), 500

# ==================== SINCRONIZACIÓN ====================
@api_bp.route('/sync/status', methods=['GET'])
def get_sync_status():
    """Obtener estado completo para sincronización"""
    try:
        device_id = request.args.get('device_id', 1, type=int)
        
        devices = CarModel.get_devices()
        commands = CarModel.get_recent_commands(device_id, 20)
        obstacles = SensorModel.get_recent_obstacles(device_id, 20)
        sequences = SequenceModel.get_sequences(10)
        
        return jsonify({
            'status': 'success',
            'data': {
                'devices': devices,
                'recent_commands': commands,
                'recent_obstacles': obstacles,
                'sequences': sequences,
                'system_status': 'online',
                'timestamp': datetime.now().isoformat()
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error en sincronización: {str(e)}'
        }), 500

# ==================== VELOCIDADES ====================
@api_bp.route('/velocidades', methods=['GET'])
def get_velocidades():
    """Obtener todas las velocidades disponibles"""
    return VelocidadController.get_all_velocidades()

@api_bp.route('/velocidades/<int:id_velocidad>', methods=['GET'])
def get_velocidad(id_velocidad):
    """Obtener una velocidad específica por ID"""
    return VelocidadController.get_velocidad_by_id(id_velocidad)

@api_bp.route('/velocidades/nombre', methods=['POST'])
def get_velocidad_by_nombre():
    """Obtener velocidad por nombre"""
    return VelocidadController.get_velocidad_by_nombre()

@api_bp.route('/velocidades/cambiar', methods=['POST'])
def cambiar_velocidad():
    """Cambiar velocidad del carro"""
    try:
        data = request.get_json()
        
        if not data:
            return make_response(jsonify({
                'status': 'error',
                'message': 'Datos requeridos'
            }), 400)
        
        velocidad = None
        if 'id_velocidad' in data:
            velocidad = VelocidadModel.get_velocidad_by_id(data['id_velocidad'])
        elif 'nombre' in data:
            velocidad = VelocidadModel.get_velocidad_by_nombre(data['nombre'])
        else:
            return make_response(jsonify({
                'status': 'error',
                'message': 'id_velocidad o nombre es requerido'
            }), 400)
        
        if not velocidad:
            return make_response(jsonify({
                'status': 'error',
                'message': 'Velocidad no encontrada'
            }), 404)
        
        # ✅ ws_server.py maneja las notificaciones
        
        return make_response(jsonify({
            'status': 'success',
            'message': f'Velocidad cambiada a {velocidad["nombre"]}',
            'data': velocidad
        }), 200)
        
    except Exception as e:
        return make_response(jsonify({
            'status': 'error',
            'message': f'Error al cambiar velocidad: {str(e)}'
        }), 500)

# ==================== ENDPOINTS PARA TABLAS ====================

@api_bp.route('/commands/history', methods=['GET'])
def get_command_history():
    """Obtener historial de comandos para tablas"""
    try:
        device_id = request.args.get('device_id', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        
        # Aquí va tu lógica para obtener comandos de la base de datos
        commands = CarModel.get_command_history(device_id, limit)
        
        return jsonify({
            'status': 'success',
            'type': 'command_history',
            'commands': commands
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error obteniendo historial: {str(e)}'
        }), 500

@api_bp.route('/sequences/table', methods=['GET'])
def get_sequences_table():
    """Obtener secuencias para tabla"""
    try:
        limit = request.args.get('limit', 50, type=int)
        
        # Tu lógica para obtener secuencias
        sequences = SequenceModel.get_sequences(limit)
        
        return jsonify({
            'status': 'success',
            'type': 'sequences_list',
            'sequences': sequences
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error obteniendo secuencias: {str(e)}'
        }), 500

@api_bp.route('/devices/table', methods=['GET'])
def get_devices_table():
    """Obtener dispositivos para tabla"""
    try:
        # Tu lógica para obtener dispositivos
        devices = CarModel.get_devices()
        
        return jsonify({
            'status': 'success',
            'type': 'devices_list',
            'devices': devices
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error obteniendo dispositivos: {str(e)}'
        }), 500

@api_bp.route('/obstacles/table', methods=['GET'])
def get_obstacles_table():
    """Obtener obstáculos para tabla"""
    try:
        device_id = request.args.get('device_id', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        
        # Tu lógica para obtener obstáculos
        obstacles = SensorModel.get_recent_obstacles(device_id, limit)
        
        return jsonify({
            'status': 'success',
            'type': 'obstacles_list',
            'obstacles': obstacles
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error obteniendo obstáculos: {str(e)}'
        }), 500

# ==================== OPTIONS para CORS ====================
@api_bp.route('/commands', methods=['OPTIONS'])
def commands_options():
    return '', 204

@api_bp.route('/obstacles', methods=['OPTIONS'])
def obstacles_options():
    return '', 204

@api_bp.route('/obstacles/manual', methods=['OPTIONS'])
def manual_obstacles_options():
    return '', 204

@api_bp.route('/sequences', methods=['OPTIONS'])
def sequences_options():
    return '', 204

@api_bp.route('/sequences/<int:id_secuencia>', methods=['OPTIONS'])
def sequence_options(id_secuencia):
    return '', 204

@api_bp.route('/sequences/<int:id_secuencia>/execute', methods=['OPTIONS'])
def execute_options(id_secuencia):
    return '', 204

@api_bp.route('/sync/status', methods=['OPTIONS'])
def sync_status_options():
    return '', 204

@api_bp.route('/devices/<int:device_id>/status', methods=['OPTIONS'])
def device_status_options(device_id):
    return '', 204

@api_bp.route('/velocidades', methods=['OPTIONS'])
def velocidades_options():
    return '', 204

@api_bp.route('/velocidades/<int:id_velocidad>', methods=['OPTIONS'])
def velocidad_options(id_velocidad):
    return '', 204

@api_bp.route('/velocidades/nombre', methods=['OPTIONS'])
def velocidad_nombre_options():
    return '', 204

@api_bp.route('/velocidades/cambiar', methods=['OPTIONS'])
def cambiar_velocidad_options():
    return '', 204

# OPTIONS para endpoints de tablas
@api_bp.route('/commands/history', methods=['OPTIONS'])
def commands_history_options():
    return '', 204

@api_bp.route('/sequences/table', methods=['OPTIONS'])
def sequences_table_options():
    return '', 204

@api_bp.route('/devices/table', methods=['OPTIONS'])
def devices_table_options():
    return '', 204

@api_bp.route('/obstacles/table', methods=['OPTIONS'])
def obstacles_table_options():
    return '', 204