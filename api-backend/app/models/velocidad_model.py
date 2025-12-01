"""
app/models/velocidad_model.py
Modelo para manejar velocidades del carro
"""

from app.config.database import get_db_connection

class VelocidadModel:
    @staticmethod
    def get_all_velocidades():
        """Obtener todas las velocidades disponibles"""
        connection = get_db_connection()
        cursor = connection.cursor()
        
        try:
            query = """
                SELECT 
                    id_velocidad,
                    nombre,
                    valor_pwm,
                    descripcion,
                    created_at
                FROM velocidades
                ORDER BY valor_pwm ASC
            """
            
            cursor.execute(query)
            velocidades = cursor.fetchall()
            
            return velocidades
            
        finally:
            cursor.close()
    
    @staticmethod
    def get_velocidad_by_id(id_velocidad):
        """Obtener una velocidad específica"""
        connection = get_db_connection()
        cursor = connection.cursor()
        
        try:
            query = """
                SELECT 
                    id_velocidad,
                    nombre,
                    valor_pwm,
                    descripcion,
                    created_at
                FROM velocidades
                WHERE id_velocidad = %s
            """
            
            cursor.execute(query, (id_velocidad,))
            velocidad = cursor.fetchone()
            
            return velocidad
            
        finally:
            cursor.close()
    
    @staticmethod
    def get_velocidad_by_nombre(nombre):
        """Obtener velocidad por nombre (baja, media, alta)"""
        connection = get_db_connection()
        cursor = connection.cursor()
        
        try:
            query = """
                SELECT 
                    id_velocidad,
                    nombre,
                    valor_pwm,
                    descripcion,
                    created_at
                FROM velocidades
                WHERE LOWER(nombre) = LOWER(%s)
            """
            
            cursor.execute(query, (nombre,))
            velocidad = cursor.fetchone()
            
            return velocidad
            
        finally:
            cursor.close()