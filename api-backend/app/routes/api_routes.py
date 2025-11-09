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

api_bp = Blueprint('api', __name__)

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
    if response[1] == 201:
        data = request.get_json()
        id_dispositivo = data.get('id_dispositivo', 1)
        
        # Obtener el último comando para enviar datos completos
        commands = CarModel.get_recent_commands(id_dispositivo, 1)
        if commands:
            emit_command_update(id_dispositivo, {
                'type': 'new_command',
                'data': commands[0]
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
    if response[1] == 201:
        data = request.get_json()
        id_dispositivo = data.get('id_dispositivo', 1)
        
        # Obtener el último obstáculo para enviar datos completos
        obstacles = SensorModel.get_recent_obstacles(id_dispositivo, 1)
        if obstacles:
            emit_obstacle_update(id_dispositivo, {
                'type': 'new_obstacle',
                'data': obstacles[0]
            })
    
    return response

@api_bp.route('/obstacles/catalog', methods=['GET'])
def get_obstacles_catalog():
    """Obtener catálogo de tipos de obstáculos"""
    return SensorController.get_obstacles_catalog()

# ==================== SECUENCIAS DEMO ====================
@api_bp.route('/sequences', methods=['GET'])
def get_sequences():
    """Obtener lista de secuencias"""
    return SequenceController.get_sequences()

@api_bp.route('/sequences', methods=['POST'])
def create_sequence():
    """Crear nueva secuencia (con notificación push)"""
    response = SequenceController.create_sequence()
    
    # Si la secuencia fue creada, notificar
    if response[1] == 201:
        data = request.get_json()
        id_dispositivo = data.get('id_dispositivo', 1)
        
        emit_sequence_update(id_dispositivo, {
            'type': 'sequence_created',
            'data': response[0].json['data']
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
    
    # Si se actualizó, notificar
    if response[0].json['status'] == 'success':
        sequence = SequenceModel.get_sequence_by_id(id_secuencia)
        if sequence:
            id_dispositivo = sequence['id_dispositivo']
            emit_sequence_update(id_dispositivo, {
                'type': 'sequence_updated',
                'data': sequence
            })
    
    return response

@api_bp.route('/sequences/<int:id_secuencia>', methods=['DELETE'])
def delete_sequence(id_secuencia):
    """Eliminar una secuencia (con notificación push)"""
    # Obtener info antes de eliminar
    sequence = SequenceModel.get_sequence_by_id(id_secuencia)
    
    response = SequenceController.delete_sequence(id_secuencia)
    
    # Si se eliminó, notificar
    if response[0].json['status'] == 'success' and sequence:
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
    
    # Si se inició la ejecución, notificar
    if response[0].json['status'] == 'success':
        sequence = SequenceModel.get_sequence_by_id(id_secuencia)
        if sequence:
            id_dispositivo = sequence['id_dispositivo']
            emit_execution_update(id_dispositivo, {
                'type': 'execution_started',
                'data': response[0].json['data']
            })
    
    return response

@api_bp.route('/sequences/execution/status', methods=['PUT'])
def update_execution_status():
    """Actualizar estado de ejecución (con notificación push)"""
    response = SequenceController.update_execution_status()
    
    # Si se actualizó, notificar
    if response[0].json['status'] == 'success':
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