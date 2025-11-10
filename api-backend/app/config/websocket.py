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
