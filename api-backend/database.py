import pymysql
from flask import g
import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    if 'db' not in g:
        g.db = pymysql.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'),
            port=int(os.getenv('DB_PORT', 3306)),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True
        )
    return g.db

def close_db_connection(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(app):
    app.teardown_appcontext(close_db_connection)
