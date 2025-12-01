<<<<<<< HEAD
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request

socketio = SocketIO(cors_allowed_origins="*", async_mode='threading')

connected_clients = {}

@socketio.on('connect')
def handle_connect():
    print(f'Cliente conectado: {request.sid}')
    emit('connection_response', {
        'status': 'connected',
        'message': 'Conectado al servidor IoT'
    })

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Cliente desconectado: {request.sid}')
    for device_id in list(connected_clients.keys()):
        if request.sid in connected_clients[device_id]:
            connected_clients[device_id].remove(request.sid)
            if not connected_clients[device_id]:
                del connected_clients[device_id]

@socketio.on('subscribe_device')
def handle_subscribe(data):
    device_id = data.get('device_id', 1)
    room = f'device_{device_id}'
    join_room(room)
    
    if device_id not in connected_clients:
        connected_clients[device_id] = []
    if request.sid not in connected_clients[device_id]:
        connected_clients[device_id].append(request.sid)
    
    print(f'Cliente {request.sid} suscrito a dispositivo {device_id}')
    emit('subscription_response', {
        'status': 'subscribed',
        'device_id': device_id,
        'message': f'Suscrito a actualizaciones del dispositivo {device_id}'
    })

@socketio.on('unsubscribe_device')
def handle_unsubscribe(data):
    device_id = data.get('device_id', 1)
    room = f'device_{device_id}'
    leave_room(room)
    
    if device_id in connected_clients and request.sid in connected_clients[device_id]:
        connected_clients[device_id].remove(request.sid)
        if not connected_clients[device_id]:
            del connected_clients[device_id]
    
    print(f'Cliente {request.sid} desuscrito de dispositivo {device_id}')
    emit('unsubscription_response', {
        'status': 'unsubscribed',
        'device_id': device_id
    })

def emit_command_update(device_id, command_data):
    room = f'device_{device_id}'
    socketio.emit('command_update', command_data, room=room)

def emit_obstacle_update(device_id, obstacle_data):
    room = f'device_{device_id}'
    socketio.emit('obstacle_update', obstacle_data, room=room)

def emit_sequence_update(device_id, sequence_data):
    room = f'device_{device_id}'
    socketio.emit('sequence_update', sequence_data, room=room)

def emit_execution_update(device_id, execution_data):
    room = f'device_{device_id}'
    socketio.emit('execution_update', execution_data, room=room)
=======
"""
app/config/websocket.py
Cliente para enviar notificaciones a ws_server.py via HTTP
"""
import requests
import json
from datetime import datetime

# URL del servidor WebSocket interno
WS_SERVER_NOTIFY_URL = "http://127.0.0.1:5502/notify"

def _send_notification(data):
    """Envía una notificación al ws_server.py"""
    try:
        response = requests.post(
            WS_SERVER_NOTIFY_URL,
            json=data,
            timeout=2
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"[WebSocket] ✅ Notificación enviada: {data.get('type')}")
            print(f"[WebSocket]    Clientes alcanzados: {result.get('clients_reached', 0)}")
            print(f"[WebSocket]    Carros alcanzados: {result.get('cars_reached', 0)}")
            return True
        else:
            print(f"[WebSocket] ⚠ Error {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"[WebSocket] ❌ No se pudo conectar a ws_server (puerto 5502)")
        print(f"[WebSocket]    Asegúrate de que ws_server.py esté corriendo")
        return False
    except Exception as e:
        print(f"[WebSocket] ❌ Error enviando notificación: {e}")
        return False

def emit_command_update(device_id, command_data):
    """Emitir actualización de comando"""
    notification = {
        'type': 'command_update',
        'device_id': device_id,
        'timestamp': datetime.now().isoformat(),
        **command_data
    }
    return _send_notification(notification)

def emit_obstacle_update(device_id, obstacle_data):
    """Emitir actualización de obstáculo"""
    notification = {
        'type': 'obstacle_update',
        'device_id': device_id,
        'timestamp': datetime.now().isoformat(),
        **obstacle_data
    }
    return _send_notification(notification)

def emit_sequence_update(device_id, sequence_data):
    """Emitir actualización de secuencia"""
    notification = {
        'type': 'sequence_update',
        'device_id': device_id,
        'timestamp': datetime.now().isoformat(),
        **sequence_data
    }
    return _send_notification(notification)

def emit_execution_update(device_id, execution_data):
    """Emitir actualización de ejecución"""
    notification = {
        'type': 'execution_update',
        'device_id': device_id,
        'timestamp': datetime.now().isoformat(),
        **execution_data
    }
    return _send_notification(notification)

def emit_data_update(update_type, data=None):
    """Emitir actualización genérica de datos"""
    notification = {
        'type': 'data_updated',
        'update_type': update_type,
        'data': data,
        'timestamp': datetime.now().isoformat()
    }
    return _send_notification(notification)

def emit_velocidad_update(device_id, velocidad_data):
    """Emitir actualización de velocidad"""
    notification = {
        'type': 'velocidad_update',
        'device_id': device_id,
        'timestamp': datetime.now().isoformat(),
        **velocidad_data
    }
    return _send_notification(notification)
>>>>>>> f49c8d2 (update apis)
