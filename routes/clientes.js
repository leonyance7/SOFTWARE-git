const express = require('express');
const router = express.Router();
const pool = require('../db'); // Importa la conexión a MySQL2

// =========================================================================
// RUTA GET para obtener todos los clientes
// =========================================================================
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                id, 
                nombre, 
                apellido, 
                email, 
                telefono, 
                documento
            FROM 
                clientes
            ORDER BY 
                apellido ASC
        `;
        const [rows] = await pool.query(query);

        res.json(rows);

    } catch (error) {
        console.error('Error al obtener la lista de clientes:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener clientes.' });
    }
});

// =========================================================================
// RUTA POST para crear un nuevo cliente
// =========================================================================
router.post('/', async (req, res) => {
    const { nombre, apellido, email, telefono, documento } = req.body;
    
    if (!nombre || !apellido || !email || !documento) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, apellido, email y documento.' });
    }

    try {
        const query = `
            INSERT INTO clientes 
                (nombre, apellido, email, telefono, documento) 
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(query, [nombre, apellido, email, telefono, documento]);

        res.status(201).json({ 
            message: 'Cliente registrado exitosamente', 
            id: result.insertId 
        });

    } catch (error) {
        // Manejo de error si el email o documento ya existen (UNIQUE constraint)
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ error: 'El email o documento ya está registrado.' });
        }
        console.error('Error al crear el cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear el cliente.' });
    }
});


// =========================================================================
// RUTA PUT para actualizar un cliente (Ejemplo de operación CRUD)
// =========================================================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, documento } = req.body;

    if (!nombre || !apellido || !email || !documento) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para la actualización.' });
    }

    try {
        const query = `
            UPDATE clientes 
            SET nombre = ?, apellido = ?, email = ?, telefono = ?, documento = ?
            WHERE id = ?
        `;
        const [result] = await pool.query(query, [nombre, apellido, email, telefono, documento, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado.' });
        }

        res.json({ message: 'Cliente actualizado correctamente.' });

    } catch (error) {
         if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ error: 'El email o documento ya está siendo usado por otro cliente.' });
        }
        console.error('Error al actualizar el cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar el cliente.' });
    }
});


module.exports = router;