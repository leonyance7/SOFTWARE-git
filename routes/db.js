const mysql = require('mysql2/promise');

// =========================================================================
// ATENCIÓN: Debes reemplazar los valores de configuración 
// con tus credenciales reales de MySQL.
// =========================================================================
const pool = mysql.createPool({
    host: 'localhost',    // Ej: 'localhost', '127.0.0.1' o la IP de tu servidor
    user: 'root',        // Ej: 'root'
    password: 'admin',    // Tu contraseña de la base de datos
    database: 'hotelsystem', // Ej: 'gestion_hotelera'
    waitForConnections: true,     // Esperar si el límite de conexiones está en uso
    connectionLimit: 10,          // Máximo número de conexiones concurrentes
    queueLimit: 0                 // Sin límite para las solicitudes en cola
});

// Prueba la conexión al iniciar la aplicación
pool.getConnection()
    .then(connection => {
        console.log('Conexión a la base de datos MySQL establecida correctamente.');
        connection.release(); // Libera la conexión de vuelta al pool
    })
    .catch(err => {
        console.error('⚠️ ERROR CRÍTICO al conectar con la base de datos:', err.message);
        // En un entorno de producción, puedes detener la aplicación aquí:
        // process.exit(1); 
    });

module.exports = pool;