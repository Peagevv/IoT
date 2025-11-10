from app.config.database import get_db_connection
from datetime import datetime

class SensorModel:
    @staticmethod
    def save_obstacle(id_dispositivo, status_obstaculo, ubicacion='frente', descripcion='', tipo='automatico'):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                INSERT INTO historial_obstaculos 
                (id_dispositivo, status_obstaculo, ubicacion, descripcion, tipo, fecha_hora)
                VALUES (%s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql, (id_dispositivo, status_obstaculo, ubicacion, descripcion, tipo, datetime.now()))
                db.commit()
                return cursor.lastrowid
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def save_manual_obstacle(id_dispositivo, status_obstaculo, ubicacion, descripcion=''):
        """Guardar obstáculo manual con tipo específico"""
        return SensorModel.save_obstacle(
            id_dispositivo, 
            status_obstaculo, 
            ubicacion, 
            descripcion, 
            'manual'
        )

    @staticmethod
    def get_recent_obstacles(id_dispositivo=1, limit=10):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                SELECT ho.*, obs.status_texto, d.nombre_dispositivo
                FROM historial_obstaculos ho
                JOIN obstaculos obs ON ho.status_obstaculo = obs.status_obstaculo
                JOIN dispositivo d ON ho.id_dispositivo = d.id_dispositivo
                WHERE ho.id_dispositivo = %s
                ORDER BY ho.fecha_hora DESC 
                LIMIT %s
                """
                cursor.execute(sql, (id_dispositivo, limit))
                return cursor.fetchall()
        except Exception as e:
            raise e

    @staticmethod
    def get_manual_obstacles(id_dispositivo=1, limit=10):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                SELECT ho.*, obs.status_texto, d.nombre_dispositivo
                FROM historial_obstaculos ho
                JOIN obstaculos obs ON ho.status_obstaculo = obs.status_obstaculo
                JOIN dispositivo d ON ho.id_dispositivo = d.id_dispositivo
                WHERE ho.id_dispositivo = %s AND ho.tipo = 'manual'
                ORDER BY ho.fecha_hora DESC 
                LIMIT %s
                """
                cursor.execute(sql, (id_dispositivo, limit))
                return cursor.fetchall()
        except Exception as e:
            raise e

    @staticmethod
    def get_obstacles_catalog():
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = "SELECT status_obstaculo, status_texto FROM obstaculos"
                cursor.execute(sql)
                return cursor.fetchall()
        except Exception as e:
            raise e

    @staticmethod
    def delete_manual_obstacle(obstacle_id):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Verificar si el obstáculo existe y es manual
                sql_check = """
                SELECT id_evento FROM historial_obstaculos 
                WHERE id_evento = %s AND tipo = 'manual'
                """
                cursor.execute(sql_check, (obstacle_id,))
                if not cursor.fetchone():
                    return False
                
                # Eliminar el obstáculo manual
                sql_delete = "DELETE FROM historial_obstaculos WHERE id_evento = %s"
                cursor.execute(sql_delete, (obstacle_id,))
                db.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            db.rollback()
            raise e