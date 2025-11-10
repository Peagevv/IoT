from flask import jsonify, request, make_response
from app.models.sequence_model import SequenceModel
import json

class SequenceController:
    @staticmethod
    def create_sequence():
        try:
            data = request.get_json()
            
            # Validar datos requeridos - ahora acepta ambas estructuras
            if not data or 'nombre_secuencia' not in data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'nombre_secuencia es requerido'
                }), 400)
            
            id_dispositivo = data.get('id_dispositivo', 1)
            nombre_secuencia = data['nombre_secuencia']
            
            # Manejar ambas estructuras: 'movimientos' (array) y 'operaciones' (string)
            movimientos = None
            
            if 'movimientos' in data:
                # Nueva estructura: array de movimientos
                if not isinstance(data['movimientos'], list) or len(data['movimientos']) == 0:
                    return make_response(jsonify({
                        'status': 'error',
                        'message': 'movimientos debe ser una lista con al menos un elemento'
                    }), 400)
                movimientos = data['movimientos']
                
            elif 'operaciones' in data:
                # Estructura antigua: string separado por comas
                operaciones_str = data['operaciones']
                try:
                    movimientos = [int(op.strip()) for op in operaciones_str.split(',')]
                    if len(movimientos) == 0:
                        return make_response(jsonify({
                            'status': 'error',
                            'message': 'operaciones debe contener al menos una operación válida'
                        }), 400)
                except ValueError:
                    return make_response(jsonify({
                        'status': 'error',
                        'message': 'operaciones debe contener números separados por comas'
                    }), 400)
            else:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'Se requiere movimientos (array) u operaciones (string)'
                }), 400)
            
            # Crear la secuencia
            id_secuencia = SequenceModel.create_sequence(
                id_dispositivo, 
                nombre_secuencia, 
                movimientos
            )
            
            return make_response(jsonify({
                'status': 'success',
                'message': 'Secuencia creada correctamente',
                'data': {
                    'id_secuencia': id_secuencia,
                    'nombre_secuencia': nombre_secuencia,
                    'total_movimientos': len(movimientos)
                }
            }), 201)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al crear secuencia: {str(e)}'
            }), 500)

    @staticmethod
    def get_sequences():
        try:
            limit = request.args.get('limit', 20, type=int)
            sequences = SequenceModel.get_sequences(limit)
            
            return make_response(jsonify({
                'status': 'success',
                'data': sequences
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': str(e)
            }), 500)

    @staticmethod
    def get_sequence_by_id(id_secuencia):
        try:
            sequence = SequenceModel.get_sequence_by_id(id_secuencia)
            
            if not sequence:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'Secuencia no encontrada'
                }), 404)
            
            return make_response(jsonify({
                'status': 'success',
                'data': sequence
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': str(e)
            }), 500)

    @staticmethod
    def update_sequence(id_secuencia):
        try:
            data = request.get_json()
            
            if not data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'No se proporcionaron datos para actualizar'
                }), 400)
            
            nombre_secuencia = data.get('nombre_secuencia')
            
            # Manejar ambas estructuras para movimientos
            movimientos = None
            if 'movimientos' in data:
                if not isinstance(data['movimientos'], list) or len(data['movimientos']) == 0:
                    return make_response(jsonify({
                        'status': 'error',
                        'message': 'movimientos debe ser una lista con al menos un elemento'
                    }), 400)
                movimientos = data['movimientos']
                
            elif 'operaciones' in data:
                try:
                    movimientos = [int(op.strip()) for op in data['operaciones'].split(',')]
                    if len(movimientos) == 0:
                        return make_response(jsonify({
                            'status': 'error',
                            'message': 'operaciones debe contener al menos una operación válida'
                        }), 400)
                except ValueError:
                    return make_response(jsonify({
                        'status': 'error',
                        'message': 'operaciones debe contener números separados por comas'
                    }), 400)
            
            success = SequenceModel.update_sequence(
                id_secuencia, 
                nombre_secuencia, 
                movimientos
            )
            
            if success:
                return make_response(jsonify({
                    'status': 'success',
                    'message': 'Secuencia actualizada correctamente'
                }), 200)
            else:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'No se pudo actualizar la secuencia'
                }), 400)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al actualizar secuencia: {str(e)}'
            }), 500)

    @staticmethod
    def delete_sequence(id_secuencia):
        try:
            success = SequenceModel.delete_sequence(id_secuencia)
            
            if success:
                return make_response(jsonify({
                    'status': 'success',
                    'message': 'Secuencia eliminada correctamente'
                }), 200)
            else:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'Secuencia no encontrada'
                }), 404)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al eliminar secuencia: {str(e)}'
            }), 500)

    @staticmethod
    def execute_sequence(id_secuencia):
        try:
            sequence = SequenceModel.get_sequence_by_id(id_secuencia)
            
            if not sequence:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'Secuencia no encontrada'
                }), 404)
            
            id_ejecucion = SequenceModel.execute_sequence(id_secuencia)
            
            return make_response(jsonify({
                'status': 'success',
                'message': 'Secuencia lista para ejecutar',
                'data': {
                    'id_ejecucion': id_ejecucion,
                    'id_secuencia': id_secuencia,
                    'operaciones': sequence['operaciones']
                }
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al ejecutar secuencia: {str(e)}'
            }), 500)

    @staticmethod
    def update_execution_status():
        try:
            data = request.get_json()
            
            if not data or 'id_ejecucion' not in data or 'estado' not in data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'id_ejecucion y estado son requeridos'
                }), 400)
            
            valid_states = ['pendiente', 'progreso', 'completado', 'cancelado', 'fallido']
            if data['estado'] not in valid_states:
                return make_response(jsonify({
                    'status': 'error',
                    'message': f'Estado inválido. Estados válidos: {valid_states}'
                }), 400)
            
            success = SequenceModel.update_execution_status(
                data['id_ejecucion'], 
                data['estado']
            )
            
            if success:
                return make_response(jsonify({
                    'status': 'success',
                    'message': 'Estado actualizado correctamente'
                }), 200)
            else:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'No se pudo actualizar el estado'
                }), 400)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al actualizar estado: {str(e)}'
            }), 500)