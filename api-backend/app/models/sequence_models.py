from app.config.database import get_db_connection
from datetime import datetime
import json

class SequenceModel:
    @staticmethod
    def create_sequence(id_dispositivo, nombre_secuencia, movimientos):
        """Crear una secuencia DEMO con sus movimientos"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Insertar la secuencia
                sql = """
                INSERT INTO secuencias_demo (id_dispositivo, nombre_secuencia, fecha_creacion)
                VALUES (%s, %s, %s)
                """
                cursor.execute(sql, (id_dispositivo, nombre_secuencia, datetime.now()))
                id_secuencia = cursor.lastrowid
                
                # Insertar las operaciones de la secuencia
                for idx, status_operacion in enumerate(movimientos, start=1):
                    sql_operacion = """
                    INSERT INTO secuencia_operaciones (id_secuencia, status_operacion, orden)
                    VALUES (%s, %s, %s)
                    """
                    cursor.execute(sql_operacion, (id_secuencia, status_operacion, idx))
                
                db.commit()
                return id_secuencia
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def get_sequences(limit=20):
        """Obtener las últimas secuencias"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                SELECT sd.*, d.nombre_dispositivo, 
                       COUNT(so.id_secuencia_operaciones) as total_movimientos
                FROM secuencias_demo sd
                JOIN dispositivo d ON sd.id_dispositivo = d.id_dispositivo
                LEFT JOIN secuencia_operaciones so ON sd.id_secuencia = so.id_secuencia
                GROUP BY sd.id_secuencia
                ORDER BY sd.fecha_creacion DESC
                LIMIT %s
                """
                cursor.execute(sql, (limit,))
                return cursor.fetchall()
        except Exception as e:
            raise e

    @staticmethod
    def get_sequence_by_id(id_secuencia):
        """Obtener una secuencia específica con sus operaciones"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Obtener info de la secuencia
                sql = """
                SELECT sd.*, d.nombre_dispositivo
                FROM secuencias_demo sd
                JOIN dispositivo d ON sd.id_dispositivo = d.id_dispositivo
                WHERE sd.id_secuencia = %s
                """
                cursor.execute(sql, (id_secuencia,))
                sequence = cursor.fetchone()
                
                if not sequence:
                    return None
                
                # Obtener las operaciones
                sql_ops = """
                SELECT so.orden, o.status_operacion, o.status_texto
                FROM secuencia_operaciones so
                JOIN operaciones o ON so.status_operacion = o.status_operacion
                WHERE so.id_secuencia = %s
                ORDER BY so.orden
                """
                cursor.execute(sql_ops, (id_secuencia,))
                operations = cursor.fetchall()
                
                sequence['operaciones'] = operations
                return sequence
        except Exception as e:
            raise e

    @staticmethod
    def update_sequence(id_secuencia, nombre_secuencia=None, movimientos=None):
        """Actualizar una secuencia"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Actualizar nombre si se proporciona
                if nombre_secuencia:
                    sql = "UPDATE secuencias_demo SET nombre_secuencia = %s WHERE id_secuencia = %s"
                    cursor.execute(sql, (nombre_secuencia, id_secuencia))
                
                # Actualizar movimientos si se proporcionan
                if movimientos:
                    # Eliminar operaciones anteriores
                    sql_delete = "DELETE FROM secuencia_operaciones WHERE id_secuencia = %s"
                    cursor.execute(sql_delete, (id_secuencia,))
                    
                    # Insertar nuevas operaciones
                    for idx, status_operacion in enumerate(movimientos, start=1):
                        sql_insert = """
                        INSERT INTO secuencia_operaciones (id_secuencia, status_operacion, orden)
                        VALUES (%s, %s, %s)
                        """
                        cursor.execute(sql_insert, (id_secuencia, status_operacion, idx))
                
                db.commit()
                return True
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def delete_sequence(id_secuencia):
        """Eliminar una secuencia"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Primero eliminar las operaciones
                sql_ops = "DELETE FROM secuencia_operaciones WHERE id_secuencia = %s"
                cursor.execute(sql_ops, (id_secuencia,))
                
                # Luego eliminar la secuencia
                sql = "DELETE FROM secuencias_demo WHERE id_secuencia = %s"
                cursor.execute(sql, (id_secuencia,))
                
                db.commit()
                return cursor.rowcount > 0
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def execute_sequence(id_secuencia):
        """Registrar la ejecución de una secuencia"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                INSERT INTO ejecucion_secuencias (id_secuencia, fecha_ejecucion, estado)
                VALUES (%s, %s, %s)
                """
                cursor.execute(sql, (id_secuencia, datetime.now(), 'pendiente'))
                db.commit()
                return cursor.lastrowid
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def update_execution_status(id_ejecucion, estado):
        """Actualizar el estado de una ejecución"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = "UPDATE ejecucion_secuencias SET estado = %s WHERE id_ejecucion = %s"
                cursor.execute(sql, (estado, id_ejecucion))
                db.commit()
                return True
        except Exception as e:
            db.rollback()
            raise e