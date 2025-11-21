import asyncio
import websockets
import json
import logging
import aiohttp
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

print("=" * 60)
print("🚀 SERVICIO WEB SOCKET INICIADO EN EC2")
print(f"📅 Iniciado: {datetime.now()}")
print("🌐 IP: 98.91.159.217")
print("📡 Puerto: 5501 (WebSocket Universal)")
print("🛣️  Rutas: /car (Carros), /client (Clientes)")
print("=" * 60)

connected_cars = {}
connected_clients = set()

# Configuración de la API
API_BASE_URL = "http://localhost:5500"  # Ajusta según tu configuración

async def registrar_obstaculo_en_bd(obstacle_data):
    """Registra un obstáculo en la base de datos via API"""
    try:
        # Mapear los datos del carro a la estructura esperada por la API
        obstacle_mapping = {
            "obstacle_detected": 1,  # Obstáculo adelante
            "obstacle_avoided_auto": 4  # Obstáculo múltiple (esquivado)
        }
        
        status_obstaculo = obstacle_mapping.get(obstacle_data.get("event"), 1)
        
        # Determinar ubicación basada en la información del obstáculo
        location = obstacle_data.get("location", "front")
        ubicacion_map = {
            "front": "frente",
            "left": "izquierda", 
            "right": "derecha",
            "back": "atras"
        }
        ubicacion = ubicacion_map.get(location, "frente")
        
        # Crear payload para la API
        payload = {
            "id_dispositivo": 1,  # ID por defecto, puedes ajustar según necesidad
            "status_obstaculo": status_obstaculo,
            "ubicacion": ubicacion,
            "descripcion": f"Obstáculo detectado a {obstacle_data.get('distance', 0)}cm - {obstacle_data.get('event', 'unknown')}",
            "automatico": True
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{API_BASE_URL}/api/obstacles/manual",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                
                if response.status == 200:
                    result = await response.json()
                    if result.get("status") == "success":
                        print(f"✅ Obstáculo registrado en BD: {obstacle_data.get('event')}")
                    else:
                        print(f"⚠️ API respondió con error: {result.get('message')}")
                else:
                    print(f"❌ Error HTTP {response.status} al registrar obstáculo")
                    
    except Exception as e:
        print(f"💥 Error registrando obstáculo en BD: {e}")

async def broadcast_to_cars(message):
    """Envía un mensaje a todos los carros conectados"""
    if connected_cars:
        print(f"📡 Transmitiendo a {len(connected_cars)} carro(s)")
        disconnected = []
        for car_id, websocket in connected_cars.items():
            try:
                await websocket.send(json.dumps(message))
                print(f"   ✅ Enviado a {car_id}: {message}")
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
                        "timestamp": datetime.now().isoformat()
                    })
                    
                elif data.get("status") == "executed":
                    print(f"✅ Carro confirmó ejecución del comando: {data.get('command')}")
                    
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
                
                # 🆕 REGISTRAR OBSTÁCULO EN BD VIA API
                elif data.get("event") in ["obstacle_detected", "obstacle_avoided", "obstacle_avoidance_failed"]:
                    print(f"🛑 EVENTO DE OBSTÁCULO: {data.get('event')}")
                    
                    # Registrar en base de datos
                    asyncio.create_task(registrar_obstaculo_en_bd(data))
                    
                    # Notificar a todos los clientes
                    await broadcast_to_clients(data)
                    
                    response = {
                        "status": "ok",
                        "message": f"Evento {data.get('event')} procesado",
                        "timestamp": datetime.now().isoformat()
                    }
                
                # 🆕 MANEJO DE TIPOS DE OBSTÁCULOS ESPECÍFICOS
                elif data.get("type") in ["obstacle_detected", "path_clear", "autonomous_action"]:
                    print(f"📊 EVENTO DEL CARRO: {data.get('type')}")
                    
                    # Notificar a todos los clientes
                    await broadcast_to_clients(data)
                    
                    response = {
                        "status": "ok",
                        "message": f"Evento {data.get('type')} procesado",
                        "timestamp": datetime.now().isoformat()
                    }
                    
                else:
                    response = {
                        "status": "ok", 
                        "received": data, 
                        "type": "car",
                        "path": path,
                        "timestamp": datetime.now().isoformat()
                    }
                    
            except json.JSONDecodeError as e:
                response = {
                    "status": "error", 
                    "message": f"Invalid JSON: {e}", 
                    "type": "car",
                    "path": path,
                    "timestamp": datetime.now().isoformat()
                }
            
            await websocket.send(json.dumps(response))
            
    except websockets.ConnectionClosed as e:
        print(f"🔌 Carro Arduino {car_id} desconectado - Código: {e.code}")
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
                
                # 🆕 Lista COMPLETA de comandos válidos (incluyendo set_speed)
                valid_commands = [
                    'forward', 'backward', 'stop',
                    'curve_forward_right', 'curve_forward_left',
                    'curve_backward_right', 'curve_backward_left',
                    'turn_right', 'turn_left',
                    'spin_right', 'spin_left',
                    'set_speed',        # 🆕 Comando de velocidad
                    'set_mode',         # 🆕 Comando de modo
                    'toggle_autonomous' # 🆕 Toggle modo autónomo
                ]
                
                if data.get("command") in valid_commands:
                    print(f"🎮 Cliente solicitó comando: {data.get('command')}")
                    
                    # 🆕 Retransmitir TODO el mensaje al carro (incluyendo speed)
                    car_command = {
                        "status": "ok",
                        "command": data.get("command"),
                        "duration": data.get("duration", 1000),
                        "speed": data.get("speed", 150),  # 🆕 Incluir velocidad
                        "mode": data.get("mode", "manual"), # 🆕 Incluir modo
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    print(f"📡 Retransmitiendo al carro: {car_command}")
                    await broadcast_to_cars(car_command)
                    
                    response = {
                        "status": "success",
                        "message": f"Comando '{data.get('command')}' enviado al carro",
                        "cars_reached": len(connected_cars),
                        "command_sent": data.get('command'),  # 🆕 Incluir comando en respuesta
                        "timestamp": datetime.now().isoformat()
                    }
                else:
                    response = {
                        "status": "success", 
                        "received": data, 
                        "type": "client",
                        "path": path,
                        "timestamp": datetime.now().isoformat()
                    }
            except json.JSONDecodeError:
                response = {
                    "status": "success", 
                    "received": message, 
                    "type": "text",
                    "path": path,
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
    print("Iniciando servidor WebSocket universal...")
    
    try:
        async with websockets.serve(universal_handler, "0.0.0.0", 5501):
            print("✅ Servidor WebSocket UNIVERSAL ACTIVO en puerto 5501")
            print("🛣️  Rutas disponibles:")
            print("   - /car     → Para carros Arduino")
            print("   - /client  → Para clientes web")
            print("🎯 Funcionalidades:")
            print("   - ✅ Comunicación bidireccional")
            print("   - ✅ Control de carros en tiempo real")
            print("   - 🆕 Registro automático de obstáculos en BD")
            print("   - 🆕 Notificaciones de eventos del carro")
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