const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); // Importamos mysql2
const app = express();
const port = 3000;

// --- Configuración de la Conexión a la Base de Datos ---
const dbPool = mysql.createPool({
    host: 'localhost',      
    user: 'root',           
    password: 'admin', 
    database: 'hotelsystem', // Nombre de la base de datos 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise(); // Usamos .promise() para poder usar async/await

// Prueba de Conexión
dbPool.getConnection()
    .then(connection => {
        console.log("✔️ Conexión exitosa a la base de datos MySQL.");
        connection.release();
    })
    .catch(err => {
        console.error("❌ Error al conectar a la base de datos:", err.message);
        process.exit(1); // Detiene la aplicación si la DB falla
    });

// --- Middlewares ---
app.use(cors());
app.use(express.json());


// =================================================================
//                      ENDPOINT DE AUTENTICACIÓN
// =================================================================

/**
 * POST /api/login
 * Intenta iniciar sesión con credenciales.
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Se requiere nombre de usuario y contraseña.' });
    }

    try {
        // En una aplicación real, se usaría bcrypt para comparar el hash de la contraseña
        const [rows] = await dbPool.query(
            'SELECT username, role FROM users WHERE username = ? AND password = ?',
            [username, password]
        );

        if (rows.length > 0) {
            const user = rows[0];
            return res.status(200).json({ 
                message: 'Autenticación exitosa', 
                role: user.role, 
                token: 'fake-jwt-token-123' 
            });
        } else {
            return res.status(401).json({ message: 'Nombre de usuario o contraseña incorrectos.' });
        }
    } catch (error) {
        console.error('Error en el login:', error);
        return res.status(500).json({ message: 'Error interno del servidor al autenticar.' });
    }
});

/**
 * POST /api/users
 * Crea un nuevo usuario (empleado) en el sistema.
 */
app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    
    const allowedRoles = ['admin', 'recepcion', 'mantenimiento'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Rol inválido: ${role}.` });
    }

    try {
        // 1. Verificar si el usuario ya existe
        const [existingUser] = await dbPool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
        }

        // 2. Insertar nuevo usuario
        // NOTA: En producción, hashear la contraseña antes de insertar
        const [result] = await dbPool.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, password, role]
        );
        
        console.log(`[LOG] Nuevo usuario creado: ${username} (${role})`);
        
        return res.status(201).json({ 
            message: 'Usuario creado satisfactoriamente.', 
            user: { id: result.insertId, username, role } 
        });

    } catch (error) {
        console.error('Error al crear usuario:', error);
        return res.status(500).json({ message: 'Error interno del servidor al crear usuario.' });
    }
});


// =================================================================
//                        ENDPOINT DE RECEPCIÓN
// =================================================================

/**
 * GET /api/habitaciones
 * Devuelve el estado actual de todas las habitaciones.
 */
app.get('/api/habitaciones', async (req, res) => {
    try {
        const [rows] = await dbPool.query('SELECT * FROM habitaciones ORDER BY id ASC');
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener habitaciones:', error);
        res.status(500).json({ message: 'Error interno del servidor al cargar habitaciones.' });
    }
});

/**
* POST /api/checkin
 * Registra un nuevo Check-In.
 */
app.post('/api/checkin', async (req, res) => {
    const { idHabitacion, nombreCompleto, fechaSalida } = req.body;

    if (!idHabitacion || !nombreCompleto || !fechaSalida) {
        return res.status(400).json({ message: 'Datos de Check-In incompletos.' });
    }

    try {
        // 1. Verificar estado actual de la habitación (Usando ID como clave primaria)
        const [roomRows] = await dbPool.query(
            'SELECT estado FROM habitaciones WHERE id = ?', [idHabitacion]
        );

        if (roomRows.length === 0) {
            return res.status(404).json({ message: `Habitación ${idHabitacion} no encontrada.` });
        }
        if (roomRows[0].estado !== 'libre') {
            return res.status(409).json({ message: `Habitación ${idHabitacion} no está libre para check-in.` });
        }

        // 2. Actualizar el estado de la habitación
        await dbPool.query(
            'UPDATE habitaciones SET estado = ?, huesped_actual = ?, checkout_date = ? WHERE id = ?',
            ['ocupada', nombreCompleto, fechaSalida, idHabitacion]
        );
        
        console.log(`[LOG] Check-in exitoso en Habitación ${idHabitacion} por ${nombreCompleto}`);
        res.status(200).json({ message: `Check-in realizado con éxito. Habitación ${idHabitacion} ocupada.` });

    } catch (error) {
        console.error('Error en el Check-In:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar Check-In.' });
    }
});

/**
 * PATCH /api/checkout/:idHabitacion
 * Realiza el Check-Out, marcando la habitación como 'limpieza'.
 */
app.patch('/api/checkout/:idHabitacion', async (req, res) => {
    const roomId = parseInt(req.params.idHabitacion);

    try {
        // 1. Verificar si está ocupada
        const [roomRows] = await dbPool.query(
            'SELECT estado FROM habitaciones WHERE id = ?', [roomId]
        );

        if (roomRows.length === 0) {
            return res.status(404).json({ message: `Habitación ${roomId} no encontrada.` });
        }
        if (roomRows[0].estado !== 'ocupada') {
            return res.status(409).json({ message: `Habitación ${roomId} no está ocupada para Check-Out.` });
        }

        // 2. Actualizar el estado a Limpieza
        await dbPool.query(
            'UPDATE habitaciones SET estado = ?, huesped_actual = NULL, checkout_date = NULL WHERE id = ?',
            ['limpieza', roomId]
        );

        console.log(`[LOG] Check-out realizado en Habitación ${roomId}. Estado: Limpieza`);
        res.status(200).json({ message: `Check-Out realizado. La Habitación ${roomId} ha sido marcada para Limpieza.` });
        
    } catch (error) {
        console.error('Error en el Check-Out:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar Check-Out.' });
    }
});




// =================================================================
//                      ENDPOINT DE ADMINISTRACIÓN (CRUD)
// =================================================================

/**
 * GET /api/admin/users
 * Lista todos los usuarios (Empleados).
 */
app.get('/api/admin/users', async (req, res) => {
    try {
        // Excluir la columna 'password' por seguridad
        const [rows] = await dbPool.query(
            'SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener la lista de usuarios.' });
    }
});

/**
 * GET /api/admin/users/:id
 * Obtiene los detalles de un solo usuario.
 */
app.get('/api/admin/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        const [rows] = await dbPool.query(
            'SELECT id, username, name, role FROM users WHERE id = ?',
            [userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error al obtener usuario por ID:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});


/**
 * PUT /api/admin/users/:id
 * Actualiza la información de un usuario existente.
 */
app.put('/api/admin/users/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, name, password, role } = req.body;

    const allowedRoles = ['admin', 'recepcion', 'mantenimiento', 'contador'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Rol inválido.` });
    }

    try {
        let sql = 'UPDATE users SET username = ?, name = ?, role = ?';
        const params = [username, name, role];

        // Solo actualiza la contraseña si se proporcionó una nueva
        if (password) {
            // NOTA: En producción, hashear la nueva contraseña aquí
            sql += ', password = ?';
            params.push(password);
        }

        sql += ' WHERE id = ?';
        params.push(userId);

        const [result] = await dbPool.query(sql, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado para actualizar.' });
        }

        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (error) {
        // Manejar error de username duplicado (código SQL 1062)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'El nombre de usuario ya está en uso.' });
        }
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor al actualizar.' });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Elimina un usuario por su ID.
 */
app.delete('/api/admin/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        const [result] = await dbPool.query('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado para eliminar.' });
        }

        res.status(200).json({ message: 'Usuario eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor al eliminar usuario.' });
    }
});

// =================================================================
//                      ENDPOINT DE INICIO (DASHBOARD)
// =================================================================

/**
 * GET /api/dashboard-summary
 * Devuelve todos los datos clave (KPIs, Gráficos) necesarios para el módulo de Inicio.
 */
app.get('/api/dashboard-summary', async (req, res) => {
    try {
        // --- 1. Obtener datos de Habitaciones ---
        const [habitaciones] = await dbPool.query('SELECT estado, checkout_date FROM habitaciones');
        const totalHabitaciones = habitaciones.length;
        let habitacionesOcupadas = 0;
        let mantenimientoActivo = 0;
        let checkoutsHoy = 0;
        
        // La fecha de hoy debe ser consistente con cómo MySQL almacena las fechas.
        const today = new Date();
        // Ajustamos la hora para que la comparación de fechas sea solo el día.
        today.setHours(0, 0, 0, 0); 
        
        habitaciones.forEach(hab => {
            if (hab.estado === 'ocupada') {
                habitacionesOcupadas++;
            }
            if (hab.estado === 'mantenimiento') {
                mantenimientoActivo++;
            }
            // Contar Check-outs programados para hoy
            if (hab.checkout_date) {
                 const checkoutDate = new Date(hab.checkout_date);
                 checkoutDate.setHours(0, 0, 0, 0); // Limpiar la hora para la comparación
                 
                if (checkoutDate.getTime() === today.getTime()) {
                    checkoutsHoy++;
                }
            }
        });
        
        // --- 2. Simulación de Mantenimiento (temporal si la tabla no existe) ---
        // Simulación: Si hay habitaciones en mantenimiento, creamos una tarea ficticia.
        let tareasMantenimientoSimuladas = [];
        if (mantenimientoActivo > 0) {
            // Buscamos las habitaciones en mantenimiento para el detalle
            const [habMant] = await dbPool.query(
                'SELECT id FROM habitaciones WHERE estado = ? LIMIT 3',
                ['mantenimiento']
            );
            
            habMant.forEach((hab, index) => {
                 tareasMantenimientoSimuladas.push({
                    id_habitacion: hab.id,
                    descripcion: `Reparación general de fallas (Simulada ${index + 1})`,
                    prioridad: index === 0 ? 'Alta' : 'Media'
                });
            });
        }
        
        // --- 3. Datos Simulados de Ventas y Ocupación Semanal ---
        const ventasHoySimuladas = 1850000; // Valor fijo para simulación
        const ocupacionSemanalSimulada = [60, 75, 50, 85, 95, 90, 70]; // Lun, Mar, Mié, Jue, Vie, Sáb, Dom

        // --- 4. Construir el objeto de respuesta ---
        const summary = {
            kpis: {
                totalHabitaciones: totalHabitaciones,
                habitacionesOcupadas: habitacionesOcupadas,
                mantenimientoActivo: mantenimientoActivo,
                checkoutsHoy: checkoutsHoy,
                ventasHoy: ventasHoySimuladas,
            },
            mantenimiento: tareasMantenimientoSimuladas, // Usando los datos simulados/parcialmente reales
            ocupacionSemanal: ocupacionSemanalSimulada,
        };

        res.status(200).json(summary);

    } catch (error) {
        console.error('Error al obtener el resumen del Dashboard:', error);
        res.status(500).json({ message: 'Error interno del servidor al cargar el dashboard.' });
    }
});

// =================================================================
//                      ENDPOINT DE MANTENIMIENTO
// =================================================================

/**
 * GET /api/mantenimiento/tareas
 * Obtiene todas las órdenes de trabajo, filtrables por estado/prioridad.
 */
app.get('/api/mantenimiento/tareas', async (req, res) => {
    const { estado, prioridad } = req.query; // Captura los filtros
    let sql = 'SELECT id, ubicacion, descripcion, asignado_a, prioridad, estado, fecha_creacion FROM mantenimiento_tareas';
    const params = [];
    const conditions = [];

    // Lógica de filtrado
    if (estado && estado !== 'Todos') {
        conditions.push('estado = ?');
        params.push(estado);
    }
    if (prioridad && prioridad !== 'Todas') {
        conditions.push('prioridad = ?');
        params.push(prioridad);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY CASE prioridad WHEN "Alta" THEN 1 WHEN "Media" THEN 2 WHEN "Baja" THEN 3 END, fecha_creacion DESC';

    try {
        const [rows] = await dbPool.query(sql, params);

        // --- Calcular KPIs (Resumen del Dashboard) ---
        const [kpiRows] = await dbPool.query(
            'SELECT estado, COUNT(id) as count FROM mantenimiento_tareas GROUP BY estado'
        );

        const kpis = {
            pendiente: 0,
            en_progreso: 0,
            completada: 0,
            resueltasHoy: 0, // Necesita lógica de fecha
        };

        kpiRows.forEach(row => {
            if (row.estado === 'pendiente') kpis.pendiente = row.count;
            if (row.estado === 'en progreso') kpis.en_progreso = row.count;
            if (row.estado === 'completada') kpis.completada = row.count;
        });
        
        // Obtener tareas resueltas hoy
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const [resueltasHoy] = await dbPool.query(
            "SELECT COUNT(id) as count FROM mantenimiento_tareas WHERE estado = 'completada' AND DATE(fecha_cierre) = ?",
            [today]
        );
        kpis.resueltasHoy = resueltasHoy[0].count;


        res.status(200).json({
            kpis: kpis,
            tareas: rows
        });

    } catch (error) {
        console.error('Error al obtener tareas de mantenimiento:', error);
        res.status(500).json({ message: 'Error interno del servidor al cargar las tareas.' });
    }
});

/**
 * PATCH /api/mantenimiento/tarea/:id/completar
 * Marca una tarea como 'completada'
 */
app.patch('/api/mantenimiento/tarea/:id/completar', async (req, res) => {
    const tareaId = req.params.id;

    try {
        const [result] = await dbPool.query(
            'UPDATE mantenimiento_tareas SET estado = ?, fecha_cierre = NOW() WHERE id = ?',
            ['completada', tareaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Tarea no encontrada.' });
        }
        
        // Opcional: Si la tarea es de una habitación, cambiar el estado de la habitación a 'libre' o 'limpieza'
        // Esto requeriría una consulta adicional si la regla es necesaria.

        res.status(200).json({ message: `Tarea #${tareaId} marcada como completada.` });
    } catch (error) {
        console.error('Error al completar tarea:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

/**
 * POST /api/mantenimiento/tarea
 * Crea una nueva orden de trabajo.
 */
app.post('/api/mantenimiento/tarea', async (req, res) => {
    const { ubicacion, descripcion, prioridad, id_habitacion, asignado_a } = req.body;
    
    if (!ubicacion || !descripcion || !prioridad) {
        return res.status(400).json({ message: 'Campos obligatorios incompletos.' });
    }
    
    const estado = asignado_a ? 'en progreso' : 'pendiente';

    try {
        const [result] = await dbPool.query(
            'INSERT INTO mantenimiento_tareas (id_habitacion, ubicacion, descripcion, prioridad, estado, asignado_a) VALUES (?, ?, ?, ?, ?, ?)',
            [id_habitacion || null, ubicacion, descripcion, prioridad, estado, asignado_a || null]
        );

        // Si se crea una tarea para una habitación, la marcamos como 'mantenimiento'
        if (id_habitacion) {
            await dbPool.query(
                "UPDATE habitaciones SET estado = 'mantenimiento' WHERE id = ?",
                [id_habitacion]
            );
        }

        res.status(201).json({ message: 'Tarea creada exitosamente.', id: result.insertId });
    } catch (error) {
        console.error('Error al crear tarea:', error);
        res.status(500).json({ message: 'Error interno del servidor al crear la tarea.' });
    }
});

// =================================================================
//                      ENDPOINT DE GESTION DE RESERVA
// =================================================================

// Incluir el módulo de reservas
const reservasRouter = require('./routes/reservas'); 
// Incluir el módulo de clientes (necesario para las FKs)
const clientesRouter = require('./routes/clientes'); 

const mantenimientoRouter = require('./routes/mantenimiento');


// Middlewares y configuración de Express.js (ya deben estar)
app.use(express.json()); // Para manejar JSON en las solicitudes
app.use(express.static('public')); // Para servir archivos HTML/CSS/JS (si tienes la carpeta 'public')


// USO DE LAS RUTAS
// ... Tus otras rutas (mantenimiento, administracion)
app.use('/api/reservas', reservasRouter); 
// Opcional pero recomendado:
app.use('/api/clientes', clientesRouter);

// =================================================================
//                      ENDPOINT DE VENTAS
// =================================================================

const ventasRouter = require('./routes/ventas'); // AÑADE ESTA LÍNEA


// Middlewares y configuración de Express.js 
app.use(express.json()); 
app.use(express.static('public')); 


// USO DE LAS RUTAS
// ... Tus otras rutas
app.use('/api/reservas', reservasRouter); 
app.use('/api/ventas', ventasRouter); // AÑADE ESTA LÍNEA

// =================================================================
//                      INICIO DEL SERVIDOR
// =================================================================

app.listen(port, () => {
    console.log('----------------------------------------------------');
    console.log(`🚀 Servidor Express corriendo en http://localhost:${port}`);
    console.log(`Conectado a la DB: hotelsystem`);
    console.log('----------------------------------------------------');
});