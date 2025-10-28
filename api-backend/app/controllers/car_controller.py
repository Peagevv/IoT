from app.models.car_model import CarModel
from app.models.sensor_model import SensorModel
from app import socketio
from flask_socketio import emit

@socketio.on('connect')
def handle_connect():
    print('Cliente WebSocket conectado')
    emit('connection_status', {'status': 'connected', 'message': 'Conectado al servidor IoT'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Cliente WebSocket desconectado')

@socketio.on('control_movement')
def handle_movement_control(data):
    try:
        id_dispositivo = data.get('id_dispositivo', 1)
        status_operacion = data.get('status_operacion')
        
        print(f'Movimiento recibido - Dispositivo: {id_dispositivo}, Operación: {status_operacion}')
        
        # Guardar en base de datos
        command_id = CarModel.save_command(id_dispositivo, status_operacion)
        
        # Transmitir comando a todos los clientes
        emit('movement_command', {
            'id_evento': command_id,
            'id_dispositivo': id_dispositivo,
            'status_operacion': status_operacion,
            'timestamp': data.get('timestamp')
        }, broadcast=True)
        
        # Confirmación al emisor
        emit('command_confirmation', {
            'status': 'success',
            'message': f'Movimiento {status_operacion} guardado correctamente'
        })
        
    except Exception as e:
        emit('command_confirmation', {
            'status': 'error',
            'message': f'Error: {str(e)}'
        })

@socketio.on('get_operations_catalog')
def handle_get_operations():
    try:
        operations = CarModel.get_operations_catalog()
        emit('operations_catalog', {
            'operations': operations
        })
    except Exception as e:
        emit('error', {'message': f'Error obteniendo operaciones: {str(e)}'})

@socketio.on('get_devices')
def handle_get_devices():
    try:
        devices = CarModel.get_devices()
        emit('devices_list', {
            'devices': devices
        })
    except Exception as e:
        emit('error', {'message': f'Error obteniendo dispositivos: {str(e)}'})