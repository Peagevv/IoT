from flask import jsonify, request, make_response
from app.models.car_model import CarModel

class CarController:
    @staticmethod
    def send_command():
        try:
            data = request.get_json()
            
            if not data or 'status_operacion' not in data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'status_operacion es requerido'
                }), 400)
            
            id_dispositivo = data.get('id_dispositivo', 1)
            status_operacion = data.get('status_operacion')
            
            operations = CarModel.get_operations_catalog()
            valid_ops = [op['status_operacion'] for op in operations]
            
            if status_operacion not in valid_ops:
                return make_response(jsonify({
                    'status': 'error',
                    'message': f'Operación inválida. Operaciones válidas: {valid_ops}'
                }), 400)
            
            id_evento = CarModel.save_command(id_dispositivo, status_operacion)
            
            return make_response(jsonify({
                'status': 'success',
                'message': 'Comando enviado correctamente',
                'data': {
                    'id_evento': id_evento,
                    'id_dispositivo': id_dispositivo,
                    'status_operacion': status_operacion
                }
            }), 201)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al enviar comando: {str(e)}'
            }), 500)

    @staticmethod
    def get_recent_commands():
        try:
            id_dispositivo = request.args.get('device_id', 1, type=int)
            limit = request.args.get('limit', 10, type=int)
            
            commands = CarModel.get_recent_commands(id_dispositivo, limit)
            
            return make_response(jsonify({
                'status': 'success',
                'data': commands
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': str(e)
            }), 500)

    @staticmethod
    def get_operations_catalog():
        try:
            operations = CarModel.get_operations_catalog()
            return make_response(jsonify({
                'status': 'success',
                'data': operations
            }), 200)
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': str(e)
            }), 500)

    @staticmethod
    def get_devices():
        try:
            devices = CarModel.get_devices()
            return make_response(jsonify({
                'status': 'success',
                'data': devices
            }), 200)
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': str(e)
            }), 500)