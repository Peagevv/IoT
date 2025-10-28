from app.models.sensor_model import SensorModel
from app import socketio
from flask_socketio import emit

@socketio.on('sensor_data')
def handle_sensor_data(data):
    try:
        id_dispositivo = data.get('id_dispositivo', 1)
        status_obstaculo = data.get('status_obstaculo')
        distance = data.get('distance', 0)
        
        print(f'Obstáculo detectado - Dispositivo: {id_dispositivo}, Tipo: {status_obstaculo}, Distancia: {distance}cm')
        
        # Guardar en base de datos
        obstacle_id = SensorModel.save_obstacle(id_dispositivo, status_obstaculo)
        
        # Transmitir a todos los clientes de monitoreo
        emit('obstacle_detected', {
            'id_evento': obstacle_id,
            'id_dispositivo': id_dispositivo,
            'status_obstaculo': status_obstaculo,
            'distance': distance,
            'timestamp': data.get('timestamp')
        }, broadcast=True)
        
    except Exception as e:
        emit('sensor_error', {
            'status': 'error',
            'message': f'Error procesando obstáculo: {str(e)}'
        })

@socketio.on('get_obstacles_catalog')
def handle_get_obstacles_catalog():
    try:
        obstacles = SensorModel.get_obstacles_catalog()
        emit('obstacles_catalog', {
            'obstacles': obstacles
        })
    except Exception as e:
        emit('error', {'message': f'Error obteniendo obstáculos: {str(e)}'})