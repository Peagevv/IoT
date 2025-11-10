from flask import jsonify, request, make_response
from app.models.sensor_model import SensorModel

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