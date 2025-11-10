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

    # ==================== MÉTODOS CRUD PARA DISPOSITIVOS ====================
    
    @staticmethod
    def create_device():
        try:
            data = request.get_json()
            
            if not data or 'nombre_dispositivo' not in data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'nombre_dispositivo es requerido'
                }), 400)
            
            nombre_dispositivo = data['nombre_dispositivo']
            descripcion = data.get('descripcion', '')
            id_cliente = data.get('id_cliente', 1)  # Default al cliente 1
            
            device_id = CarModel.create_device(
                id_cliente, 
                nombre_dispositivo, 
                descripcion
            )
            
            return make_response(jsonify({
                'status': 'success',
                'message': 'Dispositivo creado correctamente',
                'data': {
                    'id_dispositivo': device_id,
                    'nombre_dispositivo': nombre_dispositivo
                }
            }), 201)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al crear dispositivo: {str(e)}'
            }), 500)

    @staticmethod
    def update_device(device_id):
        try:
            data = request.get_json()
            
            if not data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'No se proporcionaron datos para actualizar'
                }), 400)
            
            nombre_dispositivo = data.get('nombre_dispositivo')
            descripcion = data.get('descripcion')
            
            success = CarModel.update_device(
                device_id, 
                nombre_dispositivo, 
                descripcion
            )
            
            if success:
                return make_response(jsonify({
                    'status': 'success',
                    'message': 'Dispositivo actualizado correctamente'
                }), 200)
            else:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'No se pudo actualizar el dispositivo'
                }), 400)
                
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al actualizar dispositivo: {str(e)}'
            }), 500)

    @staticmethod
    def delete_device(device_id):
        try:
            success = CarModel.delete_device(device_id)
            
            if success:
                return make_response(jsonify({
                    'status': 'success',
                    'message': 'Dispositivo eliminado correctamente'
                }), 200)
            else:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'No se pudo eliminar el dispositivo'
                }), 400)
                
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al eliminar dispositivo: {str(e)}'
            }), 500)