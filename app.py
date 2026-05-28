from flask import Flask, request, jsonify, send_from_directory
from database import get_connection, init_db
from auth import hash_password, check_password, generate_token, verify_token
import os

app = Flask(__name__, static_folder='static')

# Initialize the database on startup
init_db()

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/register')
def register_page():
    return send_from_directory('static', 'register.html')

@app.route('/dashboard')
def dashboard_page():
    return send_from_directory('static', 'dashboard.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    password = data.get('password')

    if not all([first_name, last_name, email, password]):
        return jsonify({'error': 'All fields are required'}), 400

    password_hash = hash_password(password)

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO users (first_name, last_name, email, password_hash)
            VALUES (?, ?, ?, ?)
        ''', (first_name, last_name, email, password_hash))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()

        token = generate_token(user_id, email)
        return jsonify({'token': token, 'first_name': first_name}), 201

    except Exception as e:
        return jsonify({'error': 'Email already exists'}), 409

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({'error': 'Email and password are required'}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password(password, user['password_hash']):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = generate_token(user['id'], user['email'])
    return jsonify({
        'token': token,
        'first_name': user['first_name'],
        'role': user['role']
    }), 200

@app.route('/api/me', methods=['GET'])
def me():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)

    if not payload:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, first_name, last_name, email FROM users WHERE id = ?', (payload['user_id'],))
    user = cursor.fetchone()
    conn.close()

    return jsonify(dict(user)), 200

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    date = data.get('date')
    time = data.get('time')
    reason = data.get('reason')

    if not all([date, time, reason]):
        return jsonify({'error': 'All fields are required'}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO appointments (user_id, date, time, reason)
        VALUES (?, ?, ?, ?)
    ''', (payload['user_id'], date, time, reason))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Appointment requested successfully'}), 201

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM appointments WHERE user_id = ? ORDER BY date ASC
    ''', (payload['user_id'],))
    appointments = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify(appointments), 200

@app.route('/admin')
def admin_page():
    return send_from_directory('static', 'admin.html')

@app.route('/api/admin/appointments', methods=['GET'])
def get_all_appointments():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.*, u.first_name, u.last_name, u.email
        FROM appointments a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.date ASC
    ''')
    appointments = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify(appointments), 200

@app.route('/api/admin/appointments/<int:appointment_id>/status', methods=['PUT'])
def update_appointment_status(appointment_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    status = data.get('status')

    if status not in ['confirmed', 'cancelled']:
        return jsonify({'error': 'Invalid status'}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE appointments SET status = ? WHERE id = ?', (status, appointment_id))
    conn.commit()
    conn.close()

    return jsonify({'message': f'Appointment {status}'}), 200

if __name__ == '__main__':
    app.run(debug=True)