import pymysql
from flask import g
import os

def get_db_connection():
    if 'db' not in g:
        g.db = pymysql.connect(
            host=os.environ.get('DB_HOST', 'localhost'),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('DB_PASSWORD', 'Avec86sdU1@'),
            database=os.environ.get('DB_NAME', 'IoT'),
            port=int(os.environ.get('DB_PORT', 3306)),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            ssl=None,  # Deshabilitar SSL para desarrollo local
            auth_plugin_map={},  # Evitar problemas de autenticación
            autocommit=True
        )
    return g.db

def close_db_connection(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(app):
    app.teardown_appcontext(close_db_connection)