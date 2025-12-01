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