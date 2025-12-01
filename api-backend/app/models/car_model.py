from app.config.database import get_db_connection
from datetime import datetime

class CarModel:
    @staticmethod
    def save_command(id_dispositivo, status_operacion):
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
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = "SELECT id_dispositivo, nombre_dispositivo FROM dispositivo"
                cursor.execute(sql)
                return cursor.fetchall()
        except Exception as e:
            raise e

    # ==================== MÉTODOS CRUD PARA DISPOSITIVOS ====================

    @staticmethod
    def create_device(id_cliente, nombre_dispositivo, descripcion=''):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                INSERT INTO dispositivo (id_cliente, nombre_dispositivo, descripcion)
                VALUES (%s, %s, %s)
                """
                cursor.execute(sql, (id_cliente, nombre_dispositivo, descripcion))
                device_id = cursor.lastrowid
                db.commit()
                return device_id
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def update_device(device_id, nombre_dispositivo=None, descripcion=None):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                updates = []
                params = []
                
                if nombre_dispositivo:
                    updates.append("nombre_dispositivo = %s")
                    params.append(nombre_dispositivo)
                
                if descripcion is not None:  # Permite cadena vacía
                    updates.append("descripcion = %s")
                    params.append(descripcion)
                
                if not updates:
                    return False  # No hay nada que actualizar
                    
                params.append(device_id)
                sql = f"UPDATE dispositivo SET {', '.join(updates)} WHERE id_dispositivo = %s"
                cursor.execute(sql, params)
                db.commit()
                return cursor.rowcount > 0
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def delete_device(device_id):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Verificar si el dispositivo existe
                sql_check = "SELECT id_dispositivo FROM dispositivo WHERE id_dispositivo = %s"
                cursor.execute(sql_check, (device_id,))
                if not cursor.fetchone():
                    return False
                
                # Eliminar dependencias primero (si es necesario)
                # Si hay restricciones de clave foránea, necesitarás eliminar:
                # - Secuencias asociadas
                # - Historial de operaciones
                # - Historial de obstáculos
                
                # Opción 1: Eliminar en cascada (más simple)
                sql_delete = "DELETE FROM dispositivo WHERE id_dispositivo = %s"
                cursor.execute(sql_delete, (device_id,))
                db.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            db.rollback()
            raise e