from flask import jsonify, request
from app.models.car_model import CarModel

class CarController:
    @staticmethod
    def send_command():
        """Enviar un comando al carrito"""
        try:
            data = request.get_json()
            
            if not data or 'status_operacion' not in data:
                return jsonify({
                    'status': 'error',
                    'message': 'status_operacion es requerido'
                }), 400
            
            id_dispositivo = data.get('id_dispositivo', 1)
            status_operacion = data.get('status_operacion')
            
            # Validar que el status_operacion existe
            operations = CarModel.get_operations_catalog()
            valid_ops = [op['status_operacion'] for op in operations]
            
            if status_operacion not in valid_ops:
                return jsonify({
                    'status': 'error',
                    'message': f'Operación inválida. Operaciones válidas: {valid_ops}'
                }), 400
            
            # Guardar el comando
            id_evento = CarModel.save_command(id_dispositivo, status_operacion)
            
            return jsonify({
                'status': 'success',
                'message': 'Comando enviado correctamente',
                'data': {
                    'id_evento': id_evento,
                    'id_dispositivo': id_dispositivo,
                    'status_operacion': status_operacion
                }
            }), 201
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error al enviar comando: {str(e)}'
            }), 500

    @staticmethod
    def get_recent_commands():
        """Obtener comandos recientes"""
        try:
            id_dispositivo = request.args.get('device_id', 1, type=int)
            limit = request.args.get('limit', 10, type=int)
            
            commands = CarModel.get_recent_commands(id_dispositivo, limit)
            
            return jsonify({
                'status': 'success',
                'data': commands
            })
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @staticmethod
    def get_operations_catalog():
        """Obtener catálogo de operaciones disponibles"""
        try:
            operations = CarModel.get_operations_catalog()
            return jsonify({
                'status': 'success',
                'data': operations
            })
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @staticmethod
    def get_devices():
        """Obtener lista de dispositivos"""
        try:
            devices = CarModel.get_devices()
            return jsonify({
                'status': 'success',
                'data': devices
            })
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500