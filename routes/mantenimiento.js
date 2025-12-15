const express = require('express');
const router = express.Router();
// Importa la conexión a la base de datos
const pool = require('../db'); // ¡Asegúrate de que esta ruta a tu archivo 'db.js' sea correcta!

// Función de utilidad para formatear la respuesta del estado
const formatTarea = (tarea) => {
    let tagClass = 'bg-gray-200 text-gray-800'; // Pendiente
    if (tarea.estado === 'en progreso') {
        tagClass = 'bg-yellow-100 text-yellow-800';
    } else if (tarea.estado === 'completada') {
        tagClass = 'bg-green-100 text-green-800';
    } else if (tarea.prioridad === 'Alta' && tarea.estado === 'pendiente') {
         tagClass = 'bg-red-100 text-red-800';
    }

    return {
        id: tarea.id,
        ubicacion: tarea.ubicacion,
        descripcion: tarea.descripcion,
        prioridad: tarea.prioridad,
        estado: tarea.estado.charAt(0).toUpperCase() + tarea.estado.slice(1), // Capitalizar
        tagClass: tagClass,
        asignadoA: tarea.asignado_a || 'Sin asignar',
        fechaCreacion: tarea.fecha_creacion.toISOString().split('T')[0],
        fechaCierre: tarea.fecha_cierre ? tarea.fecha_cierre.toISOString().split('T')[0] : 'N/A'
    };
};

// RUTA GET para obtener todas las tareas de mantenimiento
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id, 
                id_habitacion, 
                ubicacion, 
                descripcion, 
                prioridad, 
                estado, 
                asignado_a, 
                fecha_creacion, 
                fecha_cierre
            FROM mantenimiento_tareas
            ORDER BY prioridad DESC, fecha_creacion ASC
        `);
        
        const formattedTareas = rows.map(formatTarea);

        res.json(formattedTareas);
        
    } catch (error) {
        console.error('Error al obtener las tareas de mantenimiento:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// RUTA GET para obtener el resumen de KPIs
router.get('/kpis', async (req, res) => {
    try {
        const [kpiRows] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM mantenimiento_tareas WHERE estado = 'pendiente') AS pendientes,
                (SELECT COUNT(*) FROM mantenimiento_tareas WHERE estado = 'en progreso') AS en_progreso,
                (SELECT COUNT(*) FROM mantenimiento_tareas WHERE prioridad = 'Alta' AND estado = 'pendiente') AS urgentes
        `);

        res.json({
            pendientes: kpiRows[0].pendientes,
            enProgreso: kpiRows[0].en_progreso,
            urgentes: kpiRows[0].urgentes
        });

    } catch (error) {
        console.error('Error al obtener los KPIs de mantenimiento:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener KPIs.' });
    }
});

// RUTA POST para crear una nueva tarea
router.post('/', async (req, res) => {
    const { id_habitacion, ubicacion, descripcion, prioridad, asignado_a } = req.body;
    
    // Convertir el id_habitacion a NULL si es una cadena vacía o no es un número válido
    const habitacionId = (id_habitacion && !isNaN(parseInt(id_habitacion))) ? parseInt(id_habitacion) : null;

    if (!ubicacion || !descripcion || !prioridad) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (ubicación, descripción, prioridad).' });
    }

    try {
        const query = `
            INSERT INTO mantenimiento_tareas (id_habitacion, ubicacion, descripcion, prioridad, asignado_a)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(query, [habitacionId, ubicacion, descripcion, prioridad, asignado_a || null]);

        res.status(201).json({ 
            message: 'Tarea creada exitosamente', 
            id: result.insertId 
        });

    } catch (error) {
        // En caso de error de clave foránea (habitacionId inválido)
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(409).json({ error: 'Fallo de integridad: El ID de habitación proporcionado no existe.' });
        }
        console.error('Error al crear la tarea:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear la tarea.' });
    }
});


module.exports = router;