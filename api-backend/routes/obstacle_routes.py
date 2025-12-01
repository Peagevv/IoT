from flask import Blueprint, request, jsonify
from database import get_db_connection
from run import socketio

obstacle_bp = Blueprint('obstacle_bp', __name__)

@obstacle_bp.route('/obstacle', methods=['POST'])
def add_obstacle():
    data = request.get_json()
    print("Datos recibidos desde la web:", data)

    id_dispositivo = data.get('id_dispositivo')
    tipo_obstaculo = data.get('tipo_obstaculo')
    movimiento_realizado = data.get('movimiento_realizado', '')
    resultado = data.get('resultado', '')

    if id_dispositivo is None or tipo_obstaculo is None:
        return jsonify({'error': 'Faltan campos requeridos'}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO historial_obstaculos (id_dispositivo, status_obstaculo) VALUES (%s, %s)",
                (id_dispositivo, tipo_obstaculo)
            )
            conn.commit()

        socketio.emit('obstacle_detected', {
            'data': {
                'nombre_dispositivo': id_dispositivo,
                'status_texto': tipo_obstaculo,
                'movimiento_realizado': movimiento_realizado,
                'resultado': resultado
            }
        })

        return jsonify({'status': 'success', 'message': 'Obstáculo registrado correctamente'}), 200
    except Exception as e:
        print(f"Error al registrar obstáculo: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
