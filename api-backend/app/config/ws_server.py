import asyncio
import websockets
import json
import logging
from datetime import datetime
from aiohttp import web
import aiohttp

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

print("=" * 60)
print("🚀 SERVICIO WEB SOCKET INICIADO")
print(f"📅 Iniciado: {datetime.now()}")
print("📡 Puerto WS: 5501 (WebSocket Universal)")
print("📡 Puerto HTTP: 5502 (API Interna)")
print("🛣️  Rutas WS: /car (Carros), /client (Clientes)")
print("=" * 60)

connected_cars = {}
connected_clients = set()

API_BASE_URL = "http://127.0.0.1:5500"

# ==========================================
# FUNCIONES DE BROADCAST
# ==========================================

async def broadcast_to_cars(message):
    """Envía un mensaje a todos los carros conectados"""
    if connected_cars:
        print(f"📡 Transmitiendo a {len(connected_cars)} carro(s)")
        disconnected = []
        for car_id, websocket in connected_cars.items():
            try:
                await websocket.send(json.dumps(message))
                print(f"   ✅ Enviado a {car_id}: {message.get('command', 'data')}")
            except Exception as e:
                print(f"❌ Error enviando a carro {car_id}: {e}")
                disconnected.append(car_id)
        
        for car_id in disconnected:
            connected_cars.pop(car_id, None)
    else:
        print("⚠️ No hay carros conectados")

async def broadcast_to_clients(message):
    """Envía un mensaje a todos los clientes web conectados"""
    if connected_clients:
        disconnected = []
        for websocket in connected_clients:
            try:
                await websocket.send(json.dumps(message))
            except Exception as e:
                disconnected.append(websocket)
        
        for websocket in disconnected:
            connected_clients.discard(websocket)

# ==========================================
# FUNCIONES PARA OBTENER DATOS DE LA API
# ==========================================

async def fetch_devices():
    """Obtiene dispositivos desde la API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_BASE_URL}/api/devices") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('data', [])
    except Exception as e:
        print(f"❌ Error obteniendo dispositivos: {e}")
    return []

async def fetch_sequences():
    """Obtiene secuencias desde la API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_BASE_URL}/api/sequences") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('data', [])
    except Exception as e:
        print(f"❌ Error obteniendo secuencias: {e}")
    return []

async def fetch_obstacles(device_id=None, limit=10):
    """Obtiene obstáculos desde la API"""
    try:
        url = f"{API_BASE_URL}/api/obstacles?limit={limit}"
        if device_id:
            url += f"&device_id={device_id}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('data', [])
    except Exception as e:
        print(f"❌ Error obteniendo obstáculos: {e}")
    return []

# ==========================================
# API HTTP INTERNA PARA NOTIFICACIONES
# ==========================================

async def handle_notification(request):
    """Endpoint HTTP para recibir notificaciones desde Flask"""
    try:
        data = await request.json()
        notification_type = data.get('type')
        
        print(f"📨 Notificación recibida: {notification_type}")
        
        # Broadcast a todos los clientes
        await broadcast_to_clients(data)
        
        # Si es un comando, también enviarlo a los carros
        if notification_type in ['command_update', 'sequence_execution']:
            await broadcast_to_cars(data)
        
        return web.json_response({
            'status': 'success',
            'message': 'Notificación enviada',
            'clients_reached': len(connected_clients),
            'cars_reached': len(connected_cars)
        })
        
    except Exception as e:
        print(f"❌ Error procesando notificación: {e}")
        return web.json_response({
            'status': 'error',
            'message': str(e)
        }, status=500)

async def handle_health(request):
    """Health check del servidor HTTP interno"""
    return web.json_response({
        'status': 'ok',
        'service': 'ws_server_internal_api',
        'connected_clients': len(connected_clients),
        'connected_cars': len(connected_cars),
        'timestamp': datetime.now().isoformat()
    })

async def start_http_server():
    """Inicia el servidor HTTP interno para notificaciones"""
    app = web.Application()
    app.router.add_post('/notify', handle_notification)
    app.router.add_get('/health', handle_health)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '127.0.0.1', 5502)
    await site.start()
    
    print("✅ API HTTP interna activa en http://127.0.0.1:5502")
    print("   - POST /notify → Recibe notificaciones desde Flask")
    print("   - GET /health → Health check")

# ==========================================
# FUNCIONES DE REGISTRO EN BD
# ==========================================

async def registrar_obstaculo_en_bd(obstacle_data):
    """Registra un obstáculo en la base de datos via API"""
    try:
        obstacle_mapping = {
            "obstacle_detected": 1,
            "obstacle_avoided_auto": 4
        }
        
        status_obstaculo = obstacle_mapping.get(obstacle_data.get("event"), 1)
        
        location = obstacle_data.get("location", "front")
        ubicacion_map = {
            "front": "frente",
            "left": "izquierda", 
            "right": "derecha",
            "back": "atras"
        }
        ubicacion = ubicacion_map.get(location, "frente")
        
        payload = {
            "id_dispositivo": obstacle_data.get("id_dispositivo", 1),
            "status_obstaculo": status_obstaculo,
            "ubicacion": ubicacion,
            "descripcion": f"Obstáculo detectado a {obstacle_data.get('distance', 0)}cm - {obstacle_data.get('event', 'unknown')}",
            "tipo": "automatico"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{API_BASE_URL}/api/obstacles/manual",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                
                if response.status in [200, 201]:
                    result = await response.json()
                    if result.get("status") == "success":
                        print(f"✅ Obstáculo registrado en BD: {obstacle_data.get('event')}")
                        return True
                    else:
                        print(f"⚠️ API respondió con error: {result.get('message')}")
                else:
                    print(f"❌ Error HTTP {response.status} al registrar obstáculo")
                    
    except Exception as e:
        print(f"💥 Error registrando obstáculo en BD: {e}")
    
    return False

async def registrar_comando_en_bd(command_data):
    """Registra un comando en la base de datos via API"""
    try:
        command_to_operation = {
            'forward': 1,
            'backward': 2,
            'stop': 3,
            'curve_forward_right': 4,
            'curve_forward_left': 5,
            'curve_backward_right': 6,
            'curve_backward_left': 7,
            'turn_right': 8,
            'turn_left': 9,
            'spin_right': 10,
            'spin_left': 11
        }
        
        command = command_data.get("command")
        status_operacion = command_to_operation.get(command)
        
        if not status_operacion:
            return False
        
        payload = {
            "id_dispositivo": command_data.get("id_dispositivo", 1),
            "status_operacion": status_operacion
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{API_BASE_URL}/api/commands",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                
                if response.status in [200, 201]:
                    result = await response.json()
                    if result.get("status") == "success":
                        print(f"✅ Comando registrado en BD: {command}")
                        return True
                        
    except Exception as e:
        print(f"💥 Error registrando comando en BD: {e}")
    
    return False

# ==========================================
# HANDLERS DE WEBSOCKET
# ==========================================

async def car_handler(websocket):
    """Handler para comunicación con el carro desde Arduino"""
    client_ip = websocket.remote_address[0]
    path = websocket.request.path if hasattr(websocket, 'request') else websocket.path
    car_id = f"{client_ip}:{websocket.remote_address[1]}"
    
    print(f"🎉 🤖 CARRO CONECTADO desde: {car_id}, Ruta: {path}")
    connected_cars[car_id] = websocket
    
    try:
        welcome_msg = {
            "status": "connected", 
            "type": "car", 
            "message": "Bienvenido carro Arduino",
            "car_id": car_id,
            "path": path,
            "timestamp": datetime.now().isoformat()
        }
        await websocket.send(json.dumps(welcome_msg))
        print(f"📤 Mensaje de bienvenida enviado a carro {car_id}")
        
        await broadcast_to_clients({
            "type": "car_status",
            "status": "connected",
            "car_id": car_id,
            "timestamp": datetime.now().isoformat()
        })
        
        async for message in websocket:
            print(f"📩 Mensaje del carro {car_id}: {message}")
            
            try:
                data = json.loads(message)
                
                # HEARTBEAT
                if data.get("command") == "heartbeat":
                    response = {
                        "status": "ok", 
                        "type": "car",
                        "command": "heartbeat_ack",
                        "message": "Heartbeat recibido",
                        "battery_level": data.get("battery", "unknown"),
                        "path": path,
                        "timestamp": datetime.now().isoformat()
                    }
                    print(f"💓 Heartbeat del carro - Batería: {data.get('battery')}%")
                    
                    await broadcast_to_clients({
                        "type": "car_heartbeat",
                        "car_id": car_id,
                        "battery": data.get("battery"),
                        "speed": data.get("speed", 0),
                        "obstacle_detected": data.get("obstacle_detected", False),
                        "obstacle_distance": data.get("obstacle_distance", 0),
                        "timestamp": datetime.now().isoformat()
                    })
                
                # COMANDO EJECUTADO
                elif data.get("status") == "executed":
                    print(f"✅ Carro confirmó ejecución: {data.get('command')}")
                    
                    await broadcast_to_clients({
                        "type": "command_executed",
                        "car_id": car_id,
                        "command": data.get("command"),
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    response = {
                        "status": "ok",
                        "message": "Confirmación recibida",
                        "timestamp": datetime.now().isoformat()
                    }
                
                # OBSTÁCULOS
                elif data.get("event") in ["obstacle_detected", "obstacle_avoided", "obstacle_avoidance_failed"]:
                    print(f"🛑 EVENTO DE OBSTÁCULO: {data.get('event')}")
                    
                    asyncio.create_task(registrar_obstaculo_en_bd(data))
                    
                    await broadcast_to_clients({
                        "type": "obstacle_detected",
                        "event": data.get("event"),
                        "distance": data.get("distance", 0),
                        "location": data.get("location", "front"),
                        "action": data.get("action", "stopped"),
                        "car_id": car_id,
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    response = {
                        "status": "ok",
                        "message": f"Evento {data.get('event')} procesado",
                        "timestamp": datetime.now().isoformat()
                    }
                
                # VÍA LIBRE
                elif data.get("type") == "path_clear":
                    print(f"✅ VÍA LIBRE")
                    
                    await broadcast_to_clients({
                        "type": "path_clear",
                        "car_id": car_id,
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    response = {
                        "status": "ok",
                        "message": "Vía libre confirmada",
                        "timestamp": datetime.now().isoformat()
                    }
                    
                else:
                    response = {
                        "status": "ok", 
                        "received": data, 
                        "type": "car",
                        "timestamp": datetime.now().isoformat()
                    }
                    
            except json.JSONDecodeError as e:
                response = {
                    "status": "error", 
                    "message": f"Invalid JSON: {e}",
                    "timestamp": datetime.now().isoformat()
                }
            
            await websocket.send(json.dumps(response))
            
    except websockets.ConnectionClosed as e:
        print(f"🔌 Carro {car_id} desconectado - Código: {e.code}")
    except Exception as e:
        print(f"❌ Error con carro {car_id}: {e}")
    finally:
        connected_cars.pop(car_id, None)
        print(f"📊 Carros conectados: {len(connected_cars)}")
        
        await broadcast_to_clients({
            "type": "car_status",
            "status": "disconnected",
            "car_id": car_id,
            "timestamp": datetime.now().isoformat()
        })

async def client_handler(websocket):
    """Handler para clientes web/móviles"""
    client_ip = websocket.remote_address[0]
    path = websocket.request.path if hasattr(websocket, 'request') else websocket.path
    
    print(f"🎉 👤 CLIENTE WEB CONECTADO desde: {client_ip}, Ruta: {path}")
    connected_clients.add(websocket)
    
    try:
        welcome_msg = {
            "status": "connected", 
            "type": "client", 
            "message": "Bienvenido cliente web",
            "path": path,
            "cars_connected": len(connected_cars),
            "timestamp": datetime.now().isoformat()
        }
        await websocket.send(json.dumps(welcome_msg))
        print(f"📤 Mensaje de bienvenida enviado a cliente {client_ip}")
        
        async for message in websocket:
            print(f"📨 Mensaje del cliente web {client_ip}: {message}")
            
            try:
                data = json.loads(message)
                message_type = data.get("type")
                command = data.get("command")
                
                # DEBUG: Mostrar qué está recibiendo
                print(f"🔍 DEBUG - Tipo mensaje: {message_type}, Comando: {command}")
                
                # ========== SOLICITUD DE DISPOSITIVOS ==========
                if message_type == 'get_devices':
                    print(f"📱 Cliente solicitó dispositivos")
                    devices = await fetch_devices()
                    await websocket.send(json.dumps({
                        "type": "devices_data",
                        "data": devices,
                        "timestamp": datetime.now().isoformat()
                    }))
                
                # ========== SOLICITUD DE SECUENCIAS ==========
                elif message_type == 'get_sequences':
                    print(f"🎬 Cliente solicitó secuencias")
                    sequences = await fetch_sequences()
                    await websocket.send(json.dumps({
                        "type": "sequences_data",
                        "data": sequences,
                        "timestamp": datetime.now().isoformat()
                    }))
                
                # ========== SOLICITUD DE OBSTÁCULOS ==========
                elif message_type == 'get_obstacles':
                    print(f"🛑 Cliente solicitó obstáculos")
                    device_id = data.get("device_id")
                    obstacles = await fetch_obstacles(device_id)
                    await websocket.send(json.dumps({
                        "type": "obstacles_data",
                        "data": obstacles,
                        "timestamp": datetime.now().isoformat()
                    }))
                
                # ========== CRUD DE SECUENCIAS ==========
                elif message_type == 'create_sequence':
                    print(f"🎬 Cliente solicitó crear secuencia")
                    try:
                        nombre_secuencia = data.get('nombre_secuencia')
                        id_dispositivo = data.get('id_dispositivo', 1)
                        movimientos = data.get('movimientos', [])
                        
                        if not nombre_secuencia or not movimientos:
                            await websocket.send(json.dumps({
                                "type": "error",
                                "message": "nombre_secuencia y movimientos son requeridos",
                                "timestamp": datetime.now().isoformat()
                            }))
                            continue
                        
                        async with aiohttp.ClientSession() as session:
                            async with session.post(
                                f"{API_BASE_URL}/api/sequences",
                                json={
                                    "nombre_secuencia": nombre_secuencia,
                                    "id_dispositivo": id_dispositivo,
                                    "movimientos": movimientos
                                },
                                headers={"Content-Type": "application/json"}
                            ) as response:
                                
                                if response.status in [200, 201]:
                                    result = await response.json()
                                    
                                    await websocket.send(json.dumps({
                                        "type": "sequence_created",
                                        "status": "success",
                                        "message": "Secuencia creada correctamente",
                                        "data": result.get('data'),
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                                    await broadcast_to_clients({
                                        "type": "sequence_created",
                                        "data": result.get('data'),
                                        "timestamp": datetime.now().isoformat()
                                    })
                                    
                                    print(f"✅ Secuencia creada: {nombre_secuencia}")
                                else:
                                    error_data = await response.json()
                                    await websocket.send(json.dumps({
                                        "type": "error",
                                        "message": error_data.get('message', 'Error al crear secuencia'),
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                    except Exception as e:
                        print(f"❌ Error creando secuencia: {e}")
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": f"Error al crear secuencia: {str(e)}",
                            "timestamp": datetime.now().isoformat()
                        }))

                elif message_type == 'update_sequence':
                    print(f"🎬 Cliente solicitó actualizar secuencia")
                    try:
                        sequence_id = data.get('sequence_id')
                        nombre_secuencia = data.get('nombre_secuencia')
                        movimientos = data.get('movimientos')
                        
                        if not sequence_id:
                            await websocket.send(json.dumps({
                                "type": "error",
                                "message": "sequence_id es requerido",
                                "timestamp": datetime.now().isoformat()
                            }))
                            continue
                        
                        payload = {}
                        if nombre_secuencia:
                            payload['nombre_secuencia'] = nombre_secuencia
                        if movimientos:
                            payload['movimientos'] = movimientos
                        
                        async with aiohttp.ClientSession() as session:
                            async with session.put(
                                f"{API_BASE_URL}/api/sequences/{sequence_id}",
                                json=payload,
                                headers={"Content-Type": "application/json"}
                            ) as response:
                                
                                if response.status == 200:
                                    result = await response.json()
                                    
                                    await websocket.send(json.dumps({
                                        "type": "sequence_updated",
                                        "status": "success",
                                        "message": "Secuencia actualizada correctamente",
                                        "sequence_id": sequence_id,
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                                    await broadcast_to_clients({
                                        "type": "sequence_updated",
                                        "sequence_id": sequence_id,
                                        "timestamp": datetime.now().isoformat()
                                    })
                                    
                                    print(f"✅ Secuencia {sequence_id} actualizada")
                                else:
                                    error_data = await response.json()
                                    await websocket.send(json.dumps({
                                        "type": "error",
                                        "message": error_data.get('message', 'Error al actualizar secuencia'),
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                    except Exception as e:
                        print(f"❌ Error actualizando secuencia: {e}")
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": f"Error al actualizar secuencia: {str(e)}",
                            "timestamp": datetime.now().isoformat()
                        }))

                elif message_type == 'delete_sequence':
                    print(f"🎬 Cliente solicitó eliminar secuencia")
                    try:
                        sequence_id = data.get('sequence_id')
                        
                        if not sequence_id:
                            await websocket.send(json.dumps({
                                "type": "error",
                                "message": "sequence_id es requerido",
                                "timestamp": datetime.now().isoformat()
                            }))
                            continue
                        
                        async with aiohttp.ClientSession() as session:
                            async with session.delete(
                                f"{API_BASE_URL}/api/sequences/{sequence_id}",
                                headers={"Content-Type": "application/json"}
                            ) as response:
                                
                                if response.status == 200:
                                    await websocket.send(json.dumps({
                                        "type": "sequence_deleted",
                                        "status": "success",
                                        "message": "Secuencia eliminada correctamente",
                                        "sequence_id": sequence_id,
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                                    await broadcast_to_clients({
                                        "type": "sequence_deleted",
                                        "sequence_id": sequence_id,
                                        "timestamp": datetime.now().isoformat()
                                    })
                                    
                                    print(f"✅ Secuencia {sequence_id} eliminada")
                                else:
                                    error_data = await response.json()
                                    await websocket.send(json.dumps({
                                        "type": "error",
                                        "message": error_data.get('message', 'Error al eliminar secuencia'),
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                    except Exception as e:
                        print(f"❌ Error eliminando secuencia: {e}")
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": f"Error al eliminar secuencia: {str(e)}",
                            "timestamp": datetime.now().isoformat()
                        }))

                # ========== CRUD DE DISPOSITIVOS ==========
                elif message_type == 'create_device':
                    print(f"📱 Cliente solicitó crear dispositivo")
                    try:
                        nombre_dispositivo = data.get('nombre_dispositivo')
                        descripcion = data.get('descripcion', '')
                        
                        if not nombre_dispositivo:
                            await websocket.send(json.dumps({
                                "type": "error",
                                "message": "nombre_dispositivo es requerido",
                                "timestamp": datetime.now().isoformat()
                            }))
                            continue
                        
                        async with aiohttp.ClientSession() as session:
                            async with session.post(
                                f"{API_BASE_URL}/api/devices",
                                json={
                                    "nombre_dispositivo": nombre_dispositivo,
                                    "descripcion": descripcion
                                },
                                headers={"Content-Type": "application/json"}
                            ) as response:
                                
                                if response.status in [200, 201]:
                                    result = await response.json()
                                    
                                    await websocket.send(json.dumps({
                                        "type": "device_created",
                                        "status": "success",
                                        "message": "Dispositivo creado correctamente",
                                        "data": result.get('data'),
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                                    await broadcast_to_clients({
                                        "type": "device_created",
                                        "data": result.get('data'),
                                        "timestamp": datetime.now().isoformat()
                                    })
                                    
                                    print(f"✅ Dispositivo creado: {nombre_dispositivo}")
                                else:
                                    error_data = await response.json()
                                    await websocket.send(json.dumps({
                                        "type": "error",
                                        "message": error_data.get('message', 'Error al crear dispositivo'),
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                    except Exception as e:
                        print(f"❌ Error creando dispositivo: {e}")
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": f"Error: {str(e)}",
                            "timestamp": datetime.now().isoformat()
                        }))

                elif message_type == 'update_device':
                    print(f"📱 Cliente solicitó actualizar dispositivo")
                    try:
                        device_id = data.get('device_id')
                        nombre_dispositivo = data.get('nombre_dispositivo')
                        descripcion = data.get('descripcion')
                        
                        if not device_id:
                            await websocket.send(json.dumps({
                                "type": "error",
                                "message": "device_id es requerido",
                                "timestamp": datetime.now().isoformat()
                            }))
                            continue
                        
                        payload = {}
                        if nombre_dispositivo:
                            payload['nombre_dispositivo'] = nombre_dispositivo
                        if descripcion is not None:
                            payload['descripcion'] = descripcion
                        
                        async with aiohttp.ClientSession() as session:
                            async with session.put(
                                f"{API_BASE_URL}/api/devices/{device_id}",
                                json=payload,
                                headers={"Content-Type": "application/json"}
                            ) as response:
                                
                                if response.status == 200:
                                    await websocket.send(json.dumps({
                                        "type": "device_updated",
                                        "status": "success",
                                        "message": "Dispositivo actualizado correctamente",
                                        "device_id": device_id,
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                                    await broadcast_to_clients({
                                        "type": "device_updated",
                                        "device_id": device_id,
                                        "timestamp": datetime.now().isoformat()
                                    })
                                    
                                    print(f"✅ Dispositivo {device_id} actualizado")
                                else:
                                    error_data = await response.json()
                                    await websocket.send(json.dumps({
                                        "type": "error",
                                        "message": error_data.get('message', 'Error al actualizar dispositivo'),
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                    except Exception as e:
                        print(f"❌ Error actualizando dispositivo: {e}")
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": f"Error: {str(e)}",
                            "timestamp": datetime.now().isoformat()
                        }))

                elif message_type == 'delete_device':
                    print(f"📱 Cliente solicitó eliminar dispositivo")
                    try:
                        device_id = data.get('device_id')
                        
                        if not device_id:
                            await websocket.send(json.dumps({
                                "type": "error",
                                "message": "device_id es requerido",
                                "timestamp": datetime.now().isoformat()
                            }))
                            continue
                        
                        async with aiohttp.ClientSession() as session:
                            async with session.delete(
                                f"{API_BASE_URL}/api/devices/{device_id}",
                                headers={"Content-Type": "application/json"}
                            ) as response:
                                
                                if response.status == 200:
                                    await websocket.send(json.dumps({
                                        "type": "device_deleted",
                                        "status": "success",
                                        "message": "Dispositivo eliminado correctamente",
                                        "device_id": device_id,
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                                    await broadcast_to_clients({
                                        "type": "device_deleted",
                                        "device_id": device_id,
                                        "timestamp": datetime.now().isoformat()
                                    })
                                    
                                    print(f"✅ Dispositivo {device_id} eliminado")
                                else:
                                    error_data = await response.json()
                                    await websocket.send(json.dumps({
                                        "type": "error",
                                        "message": error_data.get('message', 'Error al eliminar dispositivo'),
                                        "timestamp": datetime.now().isoformat()
                                    }))
                                    
                    except Exception as e:
                        print(f"❌ Error eliminando dispositivo: {e}")
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": f"Error: {str(e)}",
                            "timestamp": datetime.now().isoformat()
                        }))
                
                # ========== COMANDOS DE MOVIMIENTO ==========
                # 🔥 ESTO DEBE IR DESPUÉS DE TODAS LAS VERIFICACIONES DE message_type
                elif command in ['forward', 'backward', 'stop', 
                                 'curve_forward_right', 'curve_forward_left',
                                 'curve_backward_right', 'curve_backward_left',
                                 'turn_right', 'turn_left', 'spin_right', 'spin_left',
                                 'set_speed', 'set_mode', 'toggle_autonomous', 'start_sequence']:
                    
                    print(f"🎮 Cliente solicitó comando: {command}")
                    
                    car_command = {
                        "command": command,
                        "duration": data.get("duration", 1000),
                        "speed": data.get("speed", 150),
                        "mode": data.get("mode", "manual"),
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    # Si es comando de movimiento, registrar en BD
                    if command in ['forward', 'backward', 'stop', 'curve_forward_right', 
                                    'curve_forward_left', 'curve_backward_right', 
                                    'curve_backward_left', 'turn_right', 'turn_left',
                                    'spin_right', 'spin_left']:
                        asyncio.create_task(registrar_comando_en_bd({
                            **car_command,
                            "id_dispositivo": data.get("id_dispositivo", 1)
                        }))
                    
                    print(f"📡 Retransmitiendo al carro: {car_command}")
                    await broadcast_to_cars(car_command)
                    
                    response = {
                        "status": "success",
                        "message": f"Comando '{command}' enviado",
                        "cars_reached": len(connected_cars),
                        "command_sent": command,
                        "timestamp": datetime.now().isoformat()
                    }
                    await websocket.send(json.dumps(response))
                
                # ========== RESPUESTA GENÉRICA (DEBE SER EL ÚLTIMO) ==========
                else:
                    response = {
                        "status": "success", 
                        "received": data,
                        "timestamp": datetime.now().isoformat()
                    }
                    await websocket.send(json.dumps(response))
                    print(f"📨 RESPONSE GENÉRICO enviado para mensaje tipo: {message_type}")
                    
            except json.JSONDecodeError:
                response = {
                    "status": "error", 
                    "message": "Invalid JSON",
                    "timestamp": datetime.now().isoformat()
                }
                await websocket.send(json.dumps(response))
            
    except websockets.ConnectionClosed as e:
        print(f"🔌 Cliente web {client_ip} desconectado - Código: {e.code}")
    except Exception as e:
        print(f"❌ Error con cliente {client_ip}: {e}")
    finally:
        connected_clients.discard(websocket)
        print(f"📊 Clientes conectados: {len(connected_clients)}")

async def universal_handler(websocket):
    """Manejador universal que redirige según el path"""
    path = websocket.request.path if hasattr(websocket, 'request') else websocket.path
    client_ip = websocket.remote_address[0]
    
    print(f"🌐 Nueva conexión desde: {client_ip}, Path: {path}")
    
    try:
        if path == "/car" or path.startswith("/car/"):
            await car_handler(websocket)
        elif path == "/client" or path.startswith("/client/"):
            await client_handler(websocket)
        else:
            print(f"🔍 Path '{path}' no reconocido, usando cliente por defecto")
            await client_handler(websocket)
    except Exception as e:
        print(f"💥 Error en universal_handler: {e}")
        import traceback
        traceback.print_exc()

async def main():
    print("Iniciando servidores...")
    
    try:
        # Iniciar servidor HTTP interno
        await start_http_server()
        
        # Iniciar servidor WebSocket
        async with websockets.serve(universal_handler, "0.0.0.0", 5501):
            print("✅ Servidor WebSocket UNIVERSAL ACTIVO en puerto 5501")
            print("🛣️  Rutas disponibles:")
            print("   - ws://0.0.0.0:5501/car     → Para carros Arduino")
            print("   - ws://0.0.0.0:5501/client  → Para clientes web")
            print("🎯 Funcionalidades:")
            print("   - ✅ Comunicación bidireccional")
            print("   - ✅ Control de carros en tiempo real")
            print("   - ✅ Registro automático en BD")
            print("   - ✅ Notificaciones push desde Flask")
            print("   - ✅ Respuesta a solicitudes de datos")
            print("   - ✅ CRUD de secuencias y dispositivos")
            print("🎯 Esperando conexiones...")
            print("-" * 60)
            
            await asyncio.Future()
        
    except Exception as e:
        print(f"💥 ERROR al iniciar servidor: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Servidor WebSocket detenido por usuario")
        print(f"📊 Estadísticas finales:")
        print(f"   - Carros conectados: {len(connected_cars)}")
        print(f"   - Clientes conectados: {len(connected_clients)}")
    except Exception as e:
        print(f"💥 ERROR fatal: {e}")