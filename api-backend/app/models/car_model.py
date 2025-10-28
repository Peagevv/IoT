from app.config.database import get_db_connection
from datetime import datetime

class CarModel:
    @staticmethod
    def save_command(id_dispositivo, status_operacion):
        """Guardar un movimiento en historial_operaciones"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                INSERT INTO historial_operaciones (id_dispositivo, status_operacion, fecha_hora)
                VALUES (%s, %s, %s)
                """
                cursor.execute(sql, (id_dispositivo, status_operacion, datetime.now()))
                db.commit()
                return cursor.lastrowid
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def get_recent_commands(id_dispositivo=1, limit=10):
        """Obtener movimientos recientes"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                SELECT ho.*, o.status_texto, d.nombre_dispositivo
                FROM historial_operaciones ho
                JOIN operaciones o ON ho.status_operacion = o.status_operacion
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
    def get_operations_catalog():
        """Obtener catálogo de operaciones"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = "SELECT status_operacion, status_texto FROM operaciones"
                cursor.execute(sql)
                return cursor.fetchall()
        except Exception as e:
            raise e

    @staticmethod
    def get_devices():
        """Obtener lista de dispositivos"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = "SELECT id_dispositivo, nombre_dispositivo FROM dispositivo"
                cursor.execute(sql)
                return cursor.fetchall()
        except Exception as e:
            raise e