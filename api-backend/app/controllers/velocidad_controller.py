"""
app/controllers/velocidad_controller.py
Controlador para manejar cambios de velocidad del carro
"""

from flask import jsonify, request, make_response
from app.models.velocidad_model import VelocidadModel

class VelocidadController:
    @staticmethod
    def get_all_velocidades():
        """Obtener todas las velocidades disponibles"""
        try:
            velocidades = VelocidadModel.get_all_velocidades()
            
            return make_response(jsonify({
                'status': 'success',
                'data': velocidades
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al obtener velocidades: {str(e)}'
            }), 500)
    
    @staticmethod
    def get_velocidad_by_id(id_velocidad):
        """Obtener una velocidad específica"""
        try:
            velocidad = VelocidadModel.get_velocidad_by_id(id_velocidad)
            
            if not velocidad:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'Velocidad no encontrada'
                }), 404)
            
            return make_response(jsonify({
                'status': 'success',
                'data': velocidad
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al obtener velocidad: {str(e)}'
            }), 500)
    
    @staticmethod
    def get_velocidad_by_nombre():
        """Obtener velocidad por nombre"""
        try:
            data = request.get_json()
            
            if not data or 'nombre' not in data:
                return make_response(jsonify({
                    'status': 'error',
                    'message': 'nombre es requerido'
                }), 400)
            
            nombre = data.get('nombre')
            velocidad = VelocidadModel.get_velocidad_by_nombre(nombre)
            
            if not velocidad:
                return make_response(jsonify({
                    'status': 'error',
                    'message': f'Velocidad "{nombre}" no encontrada'
                }), 404)
            
            return make_response(jsonify({
                'status': 'success',
                'data': velocidad
            }), 200)
            
        except Exception as e:
            return make_response(jsonify({
                'status': 'error',
                'message': f'Error al obtener velocidad: {str(e)}'
            }), 500)