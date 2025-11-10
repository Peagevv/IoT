from app.config.database import get_db_connection
from datetime import datetime

class SequenceModel:
    @staticmethod
    def create_sequence(id_dispositivo, nombre_secuencia, movimientos):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Insertar en secuencias_demo
                sql = """
                INSERT INTO secuencias_demo (id_dispositivo, nombre_secuencia, fecha_creacion)
                VALUES (%s, %s, %s)
                """
                cursor.execute(sql, (id_dispositivo, nombre_secuencia, datetime.now()))
                id_secuencia = cursor.lastrowid
                
                # Insertar operaciones en secuencia_operaciones
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
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                sql = """
                SELECT 
                    sd.id_secuencia,
                    sd.id_dispositivo,
                    sd.nombre_secuencia,
                    sd.fecha_creacion,
                    d.nombre_dispositivo,
                    GROUP_CONCAT(so.status_operacion ORDER BY so.orden) as operaciones,
                    COUNT(so.id_secuencia_operaciones) as total_movimientos
                FROM secuencias_demo sd
                JOIN dispositivo d ON sd.id_dispositivo = d.id_dispositivo
                LEFT JOIN secuencia_operaciones so ON sd.id_secuencia = so.id_secuencia
                GROUP BY sd.id_secuencia, sd.id_dispositivo, sd.nombre_secuencia, sd.fecha_creacion, d.nombre_dispositivo
                ORDER BY sd.fecha_creacion DESC
                LIMIT %s
                """
                cursor.execute(sql, (limit,))
                sequences = cursor.fetchall()
                
                # Convertir a formato compatible con el frontend
                formatted_sequences = []
                for seq in sequences:
                    formatted_seq = {
                        'id_secuencia': seq['id_secuencia'],
                        'id_dispositivo': seq['id_dispositivo'],
                        'nombre_secuencia': seq['nombre_secuencia'],
                        'fecha_creacion': seq['fecha_creacion'],
                        'nombre_dispositivo': seq['nombre_dispositivo'],
                        'operaciones': seq['operaciones'] if seq['operaciones'] else '',
                        'total_movimientos': seq['total_movimientos']
                    }
                    formatted_sequences.append(formatted_seq)
                
                return formatted_sequences
        except Exception as e:
            raise e

    @staticmethod
    def get_sequence_by_id(id_secuencia):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Obtener información básica de la secuencia
                sql = """
                SELECT 
                    sd.id_secuencia,
                    sd.id_dispositivo,
                    sd.nombre_secuencia,
                    sd.fecha_creacion,
                    d.nombre_dispositivo
                FROM secuencias_demo sd
                JOIN dispositivo d ON sd.id_dispositivo = d.id_dispositivo
                WHERE sd.id_secuencia = %s
                """
                cursor.execute(sql, (id_secuencia,))
                sequence = cursor.fetchone()
                
                if not sequence:
                    return None
                
                # Obtener operaciones como array
                sql_ops = """
                SELECT so.orden, o.status_operacion, o.status_texto
                FROM secuencia_operaciones so
                JOIN operaciones o ON so.status_operacion = o.status_operacion
                WHERE so.id_secuencia = %s
                ORDER BY so.orden
                """
                cursor.execute(sql_ops, (id_secuencia,))
                operations = cursor.fetchall()
                
                # Convertir operaciones a formato compatible
                operations_array = [op['status_operacion'] for op in operations]
                operations_text = [op['status_texto'] for op in operations]
                
                sequence['operaciones'] = operations_array
                sequence['operaciones_texto'] = operations_text
                sequence['operaciones_detalle'] = operations
                
                return sequence
        except Exception as e:
            raise e

    @staticmethod
    def update_sequence(id_secuencia, nombre_secuencia=None, movimientos=None):
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Actualizar nombre si se proporciona
                if nombre_secuencia:
                    sql = "UPDATE secuencias_demo SET nombre_secuencia = %s WHERE id_secuencia = %s"
                    cursor.execute(sql, (nombre_secuencia, id_secuencia))
                
                # Actualizar movimientos si se proporcionan
                if movimientos is not None:
                    # Eliminar operaciones existentes
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
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Eliminar operaciones primero (restricción de clave foránea)
                sql_ops = "DELETE FROM secuencia_operaciones WHERE id_secuencia = %s"
                cursor.execute(sql_ops, (id_secuencia,))
                
                # Eliminar la secuencia
                sql = "DELETE FROM secuencias_demo WHERE id_secuencia = %s"
                cursor.execute(sql, (id_secuencia,))
                
                db.commit()
                return cursor.rowcount > 0
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def execute_sequence(id_secuencia):
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