from flask import jsonify, request, make_response
from app.models.sensor_model import SensorModel
from app.config.websocket import emit_obstacle_update

class SensorController:
    @staticmethod
    def report_obstacle():
        try:
            data = request.get_json()
            
            if not data or 'status_obstaculo' not in data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'status_obstaculo es requerido'
                }), 400)
            
            id_dispositivo = data.get('id_dispositivo', 1)
            status_obstaculo = data.get('status_obstaculo')
            
            obstacles = SensorModel.get_obstacles_catalog()
            valid_obs = [obs['status_obstaculo'] for obs in obstacles]
            
            if status_obstaculo not in valid_obs:
                return make_response(jsonify({
                    'status': 'error',
                    'message': f'Obstáculo inválido. Obstáculos válidos: {valid_obs}'
                }), 400)
            
            id_evento = SensorModel.save_obstacle(id_dispositivo, status_obstaculo)
            
            return make_response(jsonify({
                'status': 'success',
                'message': 'Obstáculo registrado correctamente',
                'data': {
                    'id_evento': id_evento,
                    'id_dispositivo': id_dispositivo,
                    'status_obstaculo': status_obstaculo
                }
            }), 201)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al reportar obstáculo: {str(e)}'
            }), 500)

    @staticmethod
    def get_recent_obstacles():
        try:
            id_dispositivo = request.args.get('device_id', 1, type=int)
            limit = request.args.get('limit', 10, type=int)
            
            obstacles = SensorModel.get_recent_obstacles(id_dispositivo, limit)
            
            return make_response(jsonify({
                'status': 'success',
                'data': obstacles
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': str(e)
            }), 500)

    @staticmethod
    def get_obstacles_catalog():
        try:
            obstacles = SensorModel.get_obstacles_catalog()
            return make_response(jsonify({
                'status': 'success',
                'data': obstacles
            }), 200)
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': str(e)
            }), 500)

    # ==================== OBSTÁCULOS MANUALES ====================

    @staticmethod
    def create_manual_obstacle():
        try:
            data = request.get_json()
            
            if not data or 'status_obstaculo' not in data or 'ubicacion' not in data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'status_obstaculo y ubicacion son requeridos'
                }), 400)
            
            id_dispositivo = data.get('id_dispositivo', 1)
            status_obstaculo = data.get('status_obstaculo')
            ubicacion = data.get('ubicacion')  # 'frente', 'atras', 'izquierda', 'derecha', 'retroceso'
            descripcion = data.get('descripcion', '')
            
            # Validar ubicación
            ubicaciones_validas = ['frente', 'atras', 'izquierda', 'derecha', 'retroceso']
            if ubicacion not in ubicaciones_validas:
                return make_response(jsonify({
                    'status': 'error',
                    'message': f'Ubicación inválida. Ubicaciones válidas: {ubicaciones_validas}'
                }), 400)
            
            # Validar tipo de obstáculo
            obstacles = SensorModel.get_obstacles_catalog()
            valid_obs = [obs['status_obstaculo'] for obs in obstacles]
            
            if status_obstaculo not in valid_obs:
                return make_response(jsonify({
                    'status': 'error',
                    'message': f'Obstáculo inválido. Obstáculos válidos: {valid_obs}'
                }), 400)
            
            obstacle_id = SensorModel.save_manual_obstacle(
                id_dispositivo, 
                status_obstaculo, 
                ubicacion, 
                descripcion
            )
            
            # Notificar via WebSocket
            emit_obstacle_update(id_dispositivo, {
                'type': 'manual_obstacle_created',
                'data': {
                    'id_evento': obstacle_id,
                    'id_dispositivo': id_dispositivo,
                    'status_obstaculo': status_obstaculo,
                    'ubicacion': ubicacion,
                    'descripcion': descripcion,
                    'tipo': 'manual'
                }
            })
            
            return make_response(jsonify({
                'status': 'success',
                'message': 'Obstáculo manual registrado correctamente',
                'data': {
                    'id_evento': obstacle_id,
                    'id_dispositivo': id_dispositivo,
                    'status_obstaculo': status_obstaculo,
                    'ubicacion': ubicacion,
                    'descripcion': descripcion
                }
            }), 201)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al crear obstáculo manual: {str(e)}'
            }), 500)

    @staticmethod
    def get_manual_obstacles():
        try:
            id_dispositivo = request.args.get('device_id', 1, type=int)
            limit = request.args.get('limit', 10, type=int)
            
            obstacles = SensorModel.get_manual_obstacles(id_dispositivo, limit)
            
            return make_response(jsonify({
                'status': 'success',
                'data': obstacles
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': str(e)
            }), 500)

    @staticmethod
    def delete_manual_obstacle(obstacle_id):
        try:
            success = SensorModel.delete_manual_obstacle(obstacle_id)
            
            if success:
                return make_response(jsonify({
                    'status': 'success',
                    'message': 'Obstáculo manual eliminado correctamente'
                }), 200)
            else:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'No se pudo eliminar el obstáculo manual'
                }), 400)
                
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al eliminar obstáculo manual: {str(e)}'
            }), 500)