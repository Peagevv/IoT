from flask import Blueprint, jsonify, request
from database import get_db_connection
import os

api_bp = Blueprint('api', __name__)

# POST movimiento
@api_bp.route('/movement', methods=['POST'])
def add_movement():
    data = request.get_json()
    device_id = data.get('id_dispositivo')
    status_op = data.get('status_operacion')

    if device_id is None or status_op is None:
        return jsonify({'error': 'Faltan campos requeridos'}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("CALL sp_agregar_movimiento(%s, %s)", (device_id, status_op))
            result = cur.fetchone()
        return jsonify({'status': 'success', 'data': result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# GET último movimiento
@api_bp.route('/movement/latest', methods=['GET'])
def latest_movement():
    device_id = request.args.get('device_id', type=int)
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("CALL sp_ultimo_movimiento(%s)", (device_id,))
            result = cur.fetchall()
        return jsonify({'status': 'success', 'data': result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Health check
@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'IoT Car Backend',
        'version': '1.0.0',
        'database': os.getenv('DB_NAME')
    })
