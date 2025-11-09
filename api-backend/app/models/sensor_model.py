from app.config.database import get_db_connection
from datetime import datetime

class SensorModel:
    @staticmethod
    def save_obstacle(id_dispositivo, status_obstaculo):
        """Guardar un obstáculo detectado"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                INSERT INTO historial_obstaculos (id_dispositivo, status_obstaculo, fecha_hora)
                VALUES (%s, %s, %s)
                """
                cursor.execute(sql, (id_dispositivo, status_obstaculo, datetime.now()))
                db.commit()
                return cursor.lastrowid
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def get_recent_obstacles(id_dispositivo=1, limit=10):
        """Obtener obstáculos recientes"""
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
    def get_obstacles_catalog():
        """Obtener catálogo de tipos de obstáculos"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = "SELECT status_obstaculo, status_texto FROM obstaculos"
                cursor.execute(sql)
                return cursor.fetchall()
        except Exception as e:
            raise e