const express = require('express');
const router = express.Router();
// Importa la función de conexión a la base de datos que definiste previamente
const pool = require('../db'); // Asegúrate de que la ruta sea correcta

// Función de utilidad para formatear la respuesta del estado
const formatReserva = (reserva) => {
    // Ejemplo de cómo puedes agregar lógica de negocio al estado
    const today = new Date().toISOString().split('T')[0];
    let estadoTexto = reserva.estado;
    let estadoColor = 'bg-gray-200 text-gray-800'; // Default: Pendiente

    switch (reserva.estado) {
        case 'Confirmada':
            estadoColor = 'bg-blue-100 text-blue-800';
            if (reserva.fecha_llegada === today) {
                estadoTexto = 'Check-in HOY';
                estadoColor = 'bg-green-100 text-green-800';
            }
            break;
        case 'Check-in':
            estadoColor = 'bg-green-500 text-white';
            break;
        case 'Check-out':
            estadoColor = 'bg-yellow-500 text-black';
            break;
        case 'Cancelada':
            estadoColor = 'bg-red-500 text-white';
            break;
    }

    return {
        id: `#R${reserva.id}`,
        cliente: `${reserva.nombre} ${reserva.apellido}`,
        llegada: reserva.fecha_llegada,
        salida: reserva.fecha_salida,
        tipoHabitacion: reserva.tipo_habitacion,
        total: `$ ${reserva.precio_total.toLocaleString('es-CO')}`, // Formato de moneda (Colombia)
        estado: estadoTexto,
        estadoTagClass: estadoColor,
        idRaw: reserva.id // ID numérico para las acciones
    };
};


// Ruta GET para obtener todas las reservas con datos de cliente
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                r.*, 
                c.nombre, 
                c.apellido
            FROM 
                reservas r
            JOIN 
                clientes c ON r.id_cliente = c.id
            ORDER BY 
                r.fecha_llegada ASC, r.fecha_creacion DESC
        `;
        const [rows] = await pool.query(query);

        // Formatear los resultados
        const formattedReservas = rows.map(formatReserva);

        res.json(formattedReservas);

    } catch (error) {
        console.error('Error al obtener las reservas:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener las reservas.' });
    }
});


// Ruta GET para obtener un resumen de métricas clave (KPIs)
router.get('/kpis', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDate = tomorrow.toISOString().split('T')[0];

        // Consulta de Check-ins de Hoy
        const [checkinsHoy] = await pool.query(
            `SELECT COUNT(*) AS count FROM reservas WHERE fecha_llegada = ? AND estado IN ('Confirmada', 'Pendiente Pago')`,
            [today]
        );

        // Consulta de Check-outs Mañana
        const [checkoutsManana] = await pool.query(
            `SELECT COUNT(*) AS count FROM reservas WHERE fecha_salida = ? AND estado = 'Check-in'`,
            [tomorrowDate]
        );

        // Consulta de Habitaciones Disponibles (Simple: Asumiendo total de 30 habitaciones - habitaciones con Check-in)
        // **NOTA: Esta es una simplificación. En un sistema real, se usa una tabla 'habitaciones'
        // con su estado (ocupada, limpia, etc.) y se calcula la disponibilidad real.**
        const [habitacionesOcupadas] = await pool.query(`SELECT COUNT(*) AS count FROM reservas WHERE estado = 'Check-in'`);
        const totalHabitaciones = 30; // Valor fijo para la simulación
        const disponibles = totalHabitaciones - habitacionesOcupadas[0].count;


        res.json({
            checkinsHoy: checkinsHoy[0].count,
            checkoutsManana: checkoutsManana[0].count,
            habitacionesDisponibles: disponibles
        });

    } catch (error) {
        console.error('Error al obtener los KPIs de reservas:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener los KPIs.' });
    }
});


// Ruta POST para crear una nueva reserva (Ejemplo Básico)
router.post('/', async (req, res) => {
    const { id_cliente, tipo_habitacion, fecha_llegada, fecha_salida, huespedes_adultos, precio_total } = req.body;
    
    // El estado por defecto será 'Pendiente Pago'
    const estado = 'Pendiente Pago';

    if (!id_cliente || !tipo_habitacion || !fecha_llegada || !fecha_salida || !precio_total) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para crear la reserva.' });
    }

    try {
        const query = `
            INSERT INTO reservas 
                (id_cliente, tipo_habitacion, fecha_llegada, fecha_salida, huespedes_adultos, precio_total, estado) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(query, [id_cliente, tipo_habitacion, fecha_llegada, fecha_salida, huespedes_adultos, precio_total, estado]);

        res.status(201).json({ 
            message: 'Reserva creada exitosamente', 
            id: result.insertId 
        });

    } catch (error) {
        console.error('Error al crear la reserva:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear la reserva.' });
    }
});


module.exports = router;