from flask import jsonify, request
from app.models.sequence_model import SequenceModel

class SequenceController:
    @staticmethod
    def create_sequence():
        """Crear una nueva secuencia DEMO"""
        try:
            data = request.get_json()
            
            # Validaciones
            if not data or 'nombre_secuencia' not in data or 'movimientos' not in data:
                return jsonify({
                    'status': 'error',
                    'message': 'nombre_secuencia y movimientos son requeridos'
                }), 400
            
            if not isinstance(data['movimientos'], list) or len(data['movimientos']) == 0:
                return jsonify({
                    'status': 'error',
                    'message': 'movimientos debe ser una lista con al menos un elemento'
                }), 400
            
            id_dispositivo = data.get('id_dispositivo', 1)
            nombre_secuencia = data['nombre_secuencia']
            movimientos = data['movimientos']
            
            # Crear la secuencia
            id_secuencia = SequenceModel.create_sequence(
                id_dispositivo, 
                nombre_secuencia, 
                movimientos
            )
            
            return jsonify({
                'status': 'success',
                'message': 'Secuencia creada correctamente',
                'data': {
                    'id_secuencia': id_secuencia,
                    'nombre_secuencia': nombre_secuencia,
                    'total_movimientos': len(movimientos)
                }
            }), 201
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error al crear secuencia: {str(e)}'
            }), 500

    @staticmethod
    def get_sequences():
        """Obtener lista de secuencias"""
        try:
            limit = request.args.get('limit', 20, type=int)
            sequences = SequenceModel.get_sequences(limit)
            
            return jsonify({
                'status': 'success',
                'data': sequences
            })
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @staticmethod
    def get_sequence_by_id(id_secuencia):
        """Obtener una secuencia específica"""
        try:
            sequence = SequenceModel.get_sequence_by_id(id_secuencia)
            
            if not sequence:
                return jsonify({
                    'status': 'error',
                    'message': 'Secuencia no encontrada'
                }), 404
            
            return jsonify({
                'status': 'success',
                'data': sequence
            })
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @staticmethod
    def update_sequence(id_secuencia):
        """Actualizar una secuencia"""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'status': 'error',
                    'message': 'No se proporcionaron datos para actualizar'
                }), 400
            
            nombre_secuencia = data.get('nombre_secuencia')
            movimientos = data.get('movimientos')
            
            success = SequenceModel.update_sequence(
                id_secuencia, 
                nombre_secuencia, 
                movimientos
            )
            
            if success:
                return jsonify({
                    'status': 'success',
                    'message': 'Secuencia actualizada correctamente'
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'No se pudo actualizar la secuencia'
                }), 400
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error al actualizar secuencia: {str(e)}'
            }), 500

    @staticmethod
    def delete_sequence(id_secuencia):
        """Eliminar una secuencia"""
        try:
            success = SequenceModel.delete_sequence(id_secuencia)
            
            if success:
                return jsonify({
                    'status': 'success',
                    'message': 'Secuencia eliminada correctamente'
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Secuencia no encontrada'
                }), 404
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error al eliminar secuencia: {str(e)}'
            }), 500

    @staticmethod
    def execute_sequence(id_secuencia):
        """Ejecutar una secuencia"""
        try:
            # Verificar que la secuencia existe
            sequence = SequenceModel.get_sequence_by_id(id_secuencia)
            
            if not sequence:
                return jsonify({
                    'status': 'error',
                    'message': 'Secuencia no encontrada'
                }), 404
            
            # Registrar la ejecución
            id_ejecucion = SequenceModel.execute_sequence(id_secuencia)
            
            return jsonify({
                'status': 'success',
                'message': 'Secuencia lista para ejecutar',
                'data': {
                    'id_ejecucion': id_ejecucion,
                    'id_secuencia': id_secuencia,
                    'operaciones': sequence['operaciones']
                }
            }), 200
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error al ejecutar secuencia: {str(e)}'
            }), 500

    @staticmethod
    def update_execution_status():
        """Actualizar el estado de una ejecución"""
        try:
            data = request.get_json()
            
            if not data or 'id_ejecucion' not in data or 'estado' not in data:
                return jsonify({
                    'status': 'error',
                    'message': 'id_ejecucion y estado son requeridos'
                }), 400
            
            valid_states = ['pendiente', 'progreso', 'completado', 'cancelado', 'fallido']
            if data['estado'] not in valid_states:
                return jsonify({
                    'status': 'error',
                    'message': f'Estado inválido. Estados válidos: {valid_states}'
                }), 400
            
            success = SequenceModel.update_execution_status(
                data['id_ejecucion'], 
                data['estado']
            )
            
            if success:
                return jsonify({
                    'status': 'success',
                    'message': 'Estado actualizado correctamente'
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'No se pudo actualizar el estado'
                }), 400
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error al actualizar estado: {str(e)}'
            }), 500