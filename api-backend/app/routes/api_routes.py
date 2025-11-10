from flask import Blueprint, jsonify, request
from app.controllers.car_controller import CarController
from app.controllers.sensor_controller import SensorController
from app.controllers.sequence_controller import SequenceController
from app.config.websocket import (
    emit_command_update, 
    emit_obstacle_update, 
    emit_sequence_update,
    emit_execution_update
)
from app.models.car_model import CarModel
from app.models.sensor_model import SensorModel
from app.models.sequence_model import SequenceModel
from datetime import datetime

api_bp = Blueprint('api', __name__)

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
    """Enviar comando al carrito (con notificación push)"""
    response = CarController.send_command()
    
    # Si el comando fue exitoso, notificar a clientes suscritos
    if response.status_code == 201:
        data = request.get_json()
        id_dispositivo = data.get('id_dispositivo', 1)
        
        # Obtener el último comando para enviar datos completos
        commands = CarModel.get_recent_commands(id_dispositivo, 1)
        if commands:
            # Convertir datetime a string
            command_data = serialize_datetime(commands[0])
            
            emit_command_update(id_dispositivo, {
                'type': 'new_command',
                'data': command_data
            })
    
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
    """Reportar obstáculo detectado (con notificación push)"""
    response = SensorController.report_obstacle()
    
    # Si el obstáculo fue registrado, notificar a clientes suscritos
    if response.status_code == 201:
        data = request.get_json()
        id_dispositivo = data.get('id_dispositivo', 1)
        
        # Obtener el último obstáculo para enviar datos completos
        obstacles = SensorModel.get_recent_obstacles(id_dispositivo, 1)
        if obstacles:
            # Convertir datetime a string
            obstacle_data = serialize_datetime(obstacles[0])
            
            emit_obstacle_update(id_dispositivo, {
                'type': 'new_obstacle',
                'data': obstacle_data
            })
    
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
    
    # Si el obstáculo fue creado exitosamente, notificar a clientes suscritos
    if response.status_code == 201:
        data = request.get_json()
        id_dispositivo = data.get('id_dispositivo', 1)
        
        # Obtener el último obstáculo manual para enviar datos completos
        obstacles = SensorModel.get_recent_obstacles(id_dispositivo, 1)
        if obstacles:
            # Convertir datetime a string
            obstacle_data = serialize_datetime(obstacles[0])
            
            emit_obstacle_update(id_dispositivo, {
                'type': 'manual_obstacle_created',
                'data': obstacle_data
            })
    
    return response

@api_bp.route('/obstacles/manual', methods=['GET'])
def get_manual_obstacles():
    """Obtener obstáculos manuales recientes"""
    return SensorController.get_manual_obstacles()

@api_bp.route('/obstacles/manual/<int:obstacle_id>', methods=['DELETE'])
def delete_manual_obstacle(obstacle_id):
    """Eliminar obstáculo manual"""
    response = SensorController.delete_manual_obstacle(obstacle_id)
    
    # Si el obstáculo fue eliminado exitosamente, notificar a clientes suscritos
    if response.status_code == 200:
        response_data = response.get_json()
        if response_data.get('status') == 'success':
            emit_obstacle_update(1, {  # Notificar a todos los dispositivos
                'type': 'manual_obstacle_deleted',
                'data': {'id_evento': obstacle_id}
            })
    
    return response

# ==================== SECUENCIAS DEMO ====================
@api_bp.route('/sequences', methods=['GET'])
def get_sequences():
    """Obtener lista de secuencias"""
    return SequenceController.get_sequences()

@api_bp.route('/sequences', methods=['POST'])
def create_sequence():
    """Crear nueva secuencia (con notificación push)"""
    response = SequenceController.create_sequence()
    
    # CORREGIDO: Usar response directamente
    if response.status_code == 201:
        response_data = response.get_json()
        data = request.get_json()
        id_dispositivo = data.get('id_dispositivo', 1)
        
        emit_sequence_update(id_dispositivo, {
            'type': 'sequence_created',
            'data': response_data.get('data', {})
        })
    
    return response

@api_bp.route('/sequences/<int:id_secuencia>', methods=['GET'])
def get_sequence(id_secuencia):
    """Obtener una secuencia específica"""
    return SequenceController.get_sequence_by_id(id_secuencia)

@api_bp.route('/sequences/<int:id_secuencia>', methods=['PUT'])
def update_sequence(id_secuencia):
    """Actualizar una secuencia (con notificación push)"""
    response = SequenceController.update_sequence(id_secuencia)
    
    # CORREGIDO: Usar response directamente
    response_data = response.get_json()
    
    if response_data.get('status') == 'success':
        sequence = SequenceModel.get_sequence_by_id(id_secuencia)
        if sequence:
            id_dispositivo = sequence['id_dispositivo']
            # Convertir datetime
            sequence_data = serialize_datetime(sequence)
            emit_sequence_update(id_dispositivo, {
                'type': 'sequence_updated',
                'data': sequence_data
            })
    
    return response

@api_bp.route('/sequences/<int:id_secuencia>', methods=['DELETE'])
def delete_sequence(id_secuencia):
    """Eliminar una secuencia (con notificación push)"""
    # Obtener info antes de eliminar
    sequence = SequenceModel.get_sequence_by_id(id_secuencia)
    
    response = SequenceController.delete_sequence(id_secuencia)
    
    # CORREGIDO: Usar response directamente
    response_data = response.get_json()
    
    if response_data.get('status') == 'success' and sequence:
        id_dispositivo = sequence['id_dispositivo']
        emit_sequence_update(id_dispositivo, {
            'type': 'sequence_deleted',
            'data': {'id_secuencia': id_secuencia}
        })
    
    return response

@api_bp.route('/sequences/<int:id_secuencia>/execute', methods=['POST'])
def execute_sequence(id_secuencia):
    """Ejecutar una secuencia (con notificación push)"""
    response = SequenceController.execute_sequence(id_secuencia)
    
    # CORREGIDO: Usar response directamente
    response_data = response.get_json()
    
    if response_data.get('status') == 'success':
        sequence = SequenceModel.get_sequence_by_id(id_secuencia)
        if sequence:
            id_dispositivo = sequence['id_dispositivo']
            emit_execution_update(id_dispositivo, {
                'type': 'execution_started',
                'data': response_data.get('data', {})
            })
    
    return response

@api_bp.route('/sequences/execution/status', methods=['PUT'])
def update_execution_status():
    """Actualizar estado de ejecución (con notificación push)"""
    response = SequenceController.update_execution_status()
    
    # CORREGIDO: Usar response directamente
    response_data = response.get_json()
    
    if response_data.get('status') == 'success':
        data = request.get_json()
        # Aquí necesitarías obtener el id_dispositivo de la ejecución
        # Por ahora notificaremos a todos
        emit_execution_update(1, {
            'type': 'execution_status_updated',
            'data': data
        })
    
    return response

# ==================== DISPOSITIVOS ====================
@api_bp.route('/devices', methods=['GET'])
def get_devices():
    """Obtener lista de dispositivos"""
    return CarController.get_devices()

@api_bp.route('/devices', methods=['POST'])
def create_device():
    """Crear nuevo dispositivo"""
    return CarController.create_device()

@api_bp.route('/devices/<int:device_id>', methods=['PUT'])
def update_device(device_id):
    """Actualizar dispositivo"""
    return CarController.update_device(device_id)

@api_bp.route('/devices/<int:device_id>', methods=['DELETE'])
def delete_device(device_id):
    """Eliminar dispositivo"""
    return CarController.delete_device(device_id)

# ==================== SINCronización ====================
@api_bp.route('/sync/status', methods=['GET'])
def get_sync_status():
    """Obtener estado completo para sincronización"""
    try:
        device_id = request.args.get('device_id', 1, type=int)
        
        # Obtener datos actualizados
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

# Manejar OPTIONS para CORS preflight
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