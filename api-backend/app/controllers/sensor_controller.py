from flask import jsonify, request
from app.models.sensor_model import SensorModel

class SensorController:
    @staticmethod
    def report_obstacle():
        """Reportar un obstáculo detectado por el carrito"""
        try:
            data = request.get_json()
            
            if not data or 'status_obstaculo' not in data:
                return jsonify({
                    'status': 'error',
                    'message': 'status_obstaculo es requerido'
                }), 400
            
            id_dispositivo = data.get('id_dispositivo', 1)
            status_obstaculo = data.get('status_obstaculo')
            
            # Validar que el status_obstaculo existe
            obstacles = SensorModel.get_obstacles_catalog()
            valid_obs = [obs['status_obstaculo'] for obs in obstacles]
            
            if status_obstaculo not in valid_obs:
                return jsonify({
                    'status': 'error',
                    'message': f'Obstáculo inválido. Obstáculos válidos: {valid_obs}'
                }), 400
            
            # Guardar el obstáculo
            id_evento = SensorModel.save_obstacle(id_dispositivo, status_obstaculo)
            
            return jsonify({
                'status': 'success',
                'message': 'Obstáculo registrado correctamente',
                'data': {
                    'id_evento': id_evento,
                    'id_dispositivo': id_dispositivo,
                    'status_obstaculo': status_obstaculo
                }
            }), 201
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error al reportar obstáculo: {str(e)}'
            }), 500

    @staticmethod
    def get_recent_obstacles():
        """Obtener obstáculos recientes"""
        try:
            id_dispositivo = request.args.get('device_id', 1, type=int)
            limit = request.args.get('limit', 10, type=int)
            
            obstacles = SensorModel.get_recent_obstacles(id_dispositivo, limit)
            
            return jsonify({
                'status': 'success',
                'data': obstacles
            })
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @staticmethod
    def get_obstacles_catalog():
        """Obtener catálogo de tipos de obstáculos"""
        try:
            obstacles = SensorModel.get_obstacles_catalog()
            return jsonify({
                'status': 'success',
                'data': obstacles
            })
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500