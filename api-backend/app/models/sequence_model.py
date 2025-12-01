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
                    COUNT(so.id_secuencia_operaciones) as total_operaciones
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
                    # Convertir string de operaciones a array
                    operaciones_array = []
                    if seq['operaciones']:
                        operaciones_array = [int(op.strip()) for op in seq['operaciones'].split(',')]
                    
                    formatted_seq = {
                        'id_secuencia': seq['id_secuencia'],
                        'id_dispositivo': seq['id_dispositivo'],
                        'nombre_secuencia': seq['nombre_secuencia'],
                        'fecha_creacion': seq['fecha_creacion'].isoformat() if seq['fecha_creacion'] else None,
                        'nombre_dispositivo': seq['nombre_dispositivo'],
                        'operaciones': operaciones_array,
                        'total_operaciones': seq['total_operaciones']
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
                
                # 🆕 Obtener operaciones como array para WebSocket
                sql_ops = """
                SELECT so.orden, so.status_operacion, o.status_texto
                FROM secuencia_operaciones so
                LEFT JOIN operaciones o ON so.status_operacion = o.status_operacion
                WHERE so.id_secuencia = %s
                ORDER BY so.orden
                """
                cursor.execute(sql_ops, (id_secuencia,))
                operations = cursor.fetchall()
                
                # 🆕 Convertir operaciones a formato WebSocket
                operations_array = []
                for op in operations:
                    operation_data = {
                        'orden': op['orden'],
                        'status_operacion': op['status_operacion'],
                        'status_texto': op['status_texto'] or f'Operación {op["status_operacion"]}',
                        # 🆕 Mapear a comandos WebSocket
                        'comando': SequenceModel._map_operation_to_websocket_command(op['status_operacion']),
                        'nombre_operacion': SequenceModel._get_operation_name(op['status_operacion']),
                        'duracion': SequenceModel._get_operation_duration(op['status_operacion']),
                        'velocidad': 150  # Velocidad por defecto
                    }
                    operations_array.append(operation_data)
                
                sequence_data = {
                    'id_secuencia': sequence['id_secuencia'],
                    'id_dispositivo': sequence['id_dispositivo'],
                    'nombre_secuencia': sequence['nombre_secuencia'],
                    'fecha_creacion': sequence['fecha_creacion'].isoformat() if sequence['fecha_creacion'] else None,
                    'nombre_dispositivo': sequence['nombre_dispositivo'],
                    'operaciones': operations_array,
                    'total_operaciones': len(operations_array)
                }
                
                return sequence_data
        except Exception as e:
            raise e

    @staticmethod
    def _map_operation_to_websocket_command(status_operacion):
        """Mapea el código de operación a comando WebSocket"""
        command_map = {
            1: 'forward',
            2: 'backward', 
            3: 'stop',
            4: 'curve_forward_right',
            5: 'curve_forward_left',
            6: 'curve_backward_right',
            7: 'curve_backward_left',
            8: 'turn_right',
            9: 'turn_left',
            10: 'spin_right',
            11: 'spin_left'
        }
        return command_map.get(status_operacion, 'stop')

    @staticmethod
    def _get_operation_name(status_operacion):
        """Obtiene el nombre legible de la operación"""
        name_map = {
            1: 'Adelante',
            2: 'Atrás',
            3: 'Detener',
            4: 'Vuelta Adelante Derecha',
            5: 'Vuelta Adelante Izquierda',
            6: 'Vuelta Atrás Derecha',
            7: 'Vuelta Atrás Izquierda',
            8: 'Giro 90° Derecha',
            9: 'Giro 90° Izquierda',
            10: 'Giro 360° Derecha',
            11: 'Giro 360° Izquierda'
        }
        return name_map.get(status_operacion, 'Operación desconocida')

    @staticmethod
    def _get_operation_duration(status_operacion):
        """Obtiene la duración predeterminada para cada operación"""
        duration_map = {
            1: 1000,   # Adelante
            2: 1000,   # Atrás
            3: 100,    # Detener
            4: 800,    # Vuelta adelante
            5: 800,    # Vuelta adelante
            6: 800,    # Vuelta atrás
            7: 800,    # Vuelta atrás
            8: 500,    # Giro 90°
            9: 500,    # Giro 90°
            10: 2000,  # Giro 360°
            11: 2000   # Giro 360°
        }
        return duration_map.get(status_operacion, 1000)

    @staticmethod
    def get_sequence_operations(id_secuencia):
        """🆕 Método específico para obtener operaciones para WebSocket"""
        db = get_db_connection()
        try:
            with db.cursor() as cursor:
                # Obtener información básica de la secuencia
                sql = """
                SELECT 
                    sd.id_secuencia,
                    sd.id_dispositivo,
                    sd.nombre_secuencia,
                    d.nombre_dispositivo
                FROM secuencias_demo sd
                JOIN dispositivo d ON sd.id_dispositivo = d.id_dispositivo
                WHERE sd.id_secuencia = %s
                """
                cursor.execute(sql, (id_secuencia,))
                sequence = cursor.fetchone()
                
                if not sequence:
                    return None
                
                # Obtener operaciones
                sql_ops = """
                SELECT so.orden, so.status_operacion
                FROM secuencia_operaciones so
                WHERE so.id_secuencia = %s
                ORDER BY so.orden
                """
                cursor.execute(sql_ops, (id_secuencia,))
                operations = cursor.fetchall()
                
                # Formatear para WebSocket
                operations_formatted = []
                for op in operations:
                    operation_data = {
                        'comando': SequenceModel._map_operation_to_websocket_command(op['status_operacion']),
                        'nombre_operacion': SequenceModel._get_operation_name(op['status_operacion']),
                        'duracion': SequenceModel._get_operation_duration(op['status_operacion']),
                        'velocidad': 150,
                        'orden': op['orden']
                    }
                    operations_formatted.append(operation_data)
                
                result = {
                    'id_secuencia': sequence['id_secuencia'],
                    'nombre_secuencia': sequence['nombre_secuencia'],
                    'id_dispositivo': sequence['id_dispositivo'],
                    'nombre_dispositivo': sequence['nombre_dispositivo'],
                    'operaciones': operations_formatted,
                    'total_operaciones': len(operations_formatted)
                }
                
                return result
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

    # 🆕 MÉTODOS ESPECÍFICOS PARA WEBSOCKET

    @staticmethod
    def prepare_sequence_for_websocket(id_secuencia):
        """Prepara una secuencia para ser enviada por WebSocket"""
        sequence_data = SequenceModel.get_sequence_operations(id_secuencia)
        if not sequence_data:
            return None
        
        # Formatear para el comando start_sequence del WebSocket
        websocket_data = {
            'id_secuencia': sequence_data['id_secuencia'],
            'nombre_secuencia': sequence_data['nombre_secuencia'],
            'operaciones': sequence_data['operaciones']
        }
        
        return websocket_data

    @staticmethod
    def validate_sequence_operations(operations):
        """Valida que las operaciones sean válidas para WebSocket"""
        valid_operations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        for op in operations:
            if op not in valid_operations:
                return False, f"Operación inválida: {op}"
        return True, "Operaciones válidas"