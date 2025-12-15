# Importación de módulos necesarios de Flask y seguridad
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

# ----------------------------------------------------
# CONFIGURACIÓN DE LA APLICACIÓN
# ----------------------------------------------------

app = Flask(__name__)

# Base de datos en memoria para este ejercicio.
USUARIOS_DB = {}

# ----------------------------------------------------
# SERVICIO PARA REGISTRO
# ----------------------------------------------------

@app.route('/register', methods=['POST'])
def register():
    """
    Endpoint para el registro de nuevos usuarios.
    Recibe un JSON con 'usuario' y 'contrasena'.
    """
    # 1. Obtener los datos de la solicitud POST
    data = request.get_json()
    usuario = data.get('usuario')
    contrasena = data.get('contrasena')

    # 2. Validar que se hayan enviado ambos campos
    if not usuario or not contrasena:
        return jsonify({'mensaje': 'Error: Faltan usuario o contraseña'}), 400

    # 3. Verificar si el usuario ya existe
    if usuario in USUARIOS_DB:
        return jsonify({'mensaje': 'Error: El usuario ya existe'}), 409

    # 4. Encriptar la contraseña (hashing) antes de guardarla por seguridad
    hashed_password = generate_password_hash(contrasena)

    # 5. Guardar el nuevo usuario en la "base de datos"
    USUARIOS_DB[usuario] = {'password_hash': hashed_password}

    # 6. Devolver una respuesta exitosa
    return jsonify({'mensaje': 'Registro de usuario satisfactorio'}), 201

# ----------------------------------------------------
# SERVICIO PARA INICIO DE SESIÓN
# ----------------------------------------------------

@app.route('/login', methods=['POST'])
def login():
    """
    Endpoint para el inicio de sesión (autenticación).
    Recibe un JSON con 'usuario' y 'contrasena'.
    """
    # 1. Obtener los datos de la solicitud POST
    data = request.get_json()
    usuario = data.get('usuario')
    contrasena = data.get('contrasena')

    # 2. Validar que se hayan enviado ambos campos
    if not usuario or not contrasena:
        # Validación de campos nulos
        return jsonify({'mensaje': 'Error en la autenticación: Faltan datos'}), 400

    # 3. Verificar si el usuario existe en la DB
    if usuario not in USUARIOS_DB:
        # Validación de usuario no encontrado
        # Por seguridad, el mensaje es genérico para no dar pistas
        return jsonify({'mensaje': 'Error en la autenticación'}), 401

    # 4. Obtener el hash de la contraseña guardada
    hashed_password = USUARIOS_DB[usuario]['password_hash']

    # 5. VALIDACIÓN DE VERIFICACIÓN (Punto 3: 25%)
    # Comparar la contraseña ingresada con el hash guardado
    if check_password_hash(hashed_password, contrasena):
        # Autenticación Correcta
        return jsonify({'mensaje': 'Autenticación satisfactoria'}), 200
    else:
        # Autenticación Incorrecta (Contraseña no coincide)
        return jsonify({'mensaje': 'Error en la autenticación'}), 401


# ----------------------------------------------------
# INICIO DEL SERVIDOR
# ----------------------------------------------------

if __name__ == '__main__':
    # El modo debug ayuda durante el desarrollo
    app.run(debug=True)