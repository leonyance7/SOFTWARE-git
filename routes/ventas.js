const express = require('express');
const router = express.Router();
const pool = require('../db'); // Importa la conexión a MySQL2

// Función de utilidad para formatear transacciones
const formatTransaccion = (t) => {
    // Definir la referencia basada en si está ligada a una reserva o no
    let referencia = t.nombre_cliente ? `${t.nombre_cliente} ${t.apellido_cliente}` : 'Venta Externa';
    if (t.id_reserva) {
        referencia = `Reserva #R${t.id_reserva} (${t.concepto_hab || 'Alojamiento'})`;
    }

    let tagClass = 'bg-gray-200 text-gray-800';
    switch (t.fuente) {
        case 'Alojamiento':
            tagClass = 'bg-blue-100 text-blue-800';
            break;
        case 'Restaurante':
            tagClass = 'bg-yellow-100 text-yellow-800';
            break;
        case 'Minibar':
        case 'Servicios':
            tagClass = 'bg-green-100 text-green-800';
            break;
    }

    return {
        facturaId: t.factura_id,
        referencia: referencia,
        fecha: t.fecha_transaccion.toISOString().split('T')[0],
        monto: `$ ${t.monto.toLocaleString('es-CO')}`,
        fuente: t.fuente,
        tagClass: tagClass,
        metodoPago: t.metodo_pago
    };
};

// =========================================================================
// RUTA GET para obtener los KPIs Financieros
// =========================================================================
router.get('/kpis', async (req, res) => {
    try {
        // Obtenemos el mes actual y el mes anterior
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1 = Enero, 12 = Diciembre
        
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear -= 1;
        }

        // Consultas para Ventas Netas del mes y mes anterior
        const [ventasData] = await pool.query(`
            SELECT 
                SUM(CASE WHEN MONTH(fecha_transaccion) = ? AND YEAR(fecha_transaccion) = ? THEN monto ELSE 0 END) AS ventas_mes_actual,
                SUM(CASE WHEN MONTH(fecha_transaccion) = ? AND YEAR(fecha_transaccion) = ? THEN monto ELSE 0 END) AS ventas_mes_anterior,
                COUNT(DISTINCT id_reserva) AS total_reservas
            FROM 
                transacciones
            WHERE 
                fuente = 'Alojamiento' AND (
                    (MONTH(fecha_transaccion) = ? AND YEAR(fecha_transaccion) = ?) OR 
                    (MONTH(fecha_transaccion) = ? AND YEAR(fecha_transaccion) = ?)
                );
        `, [month, year, prevMonth, prevYear, month, year, prevMonth, prevYear]);

        const ventasActual = parseFloat(ventasData[0].ventas_mes_actual || 0);
        const ventasAnterior = parseFloat(ventasData[0].ventas_mes_anterior || 1); // Evitar división por cero
        const totalReservas = ventasData[0].total_reservas;

        // Cálculo de métricas
        const crecimiento = ((ventasActual - ventasAnterior) / ventasAnterior) * 100;
        const ticketPromedio = totalReservas > 0 ? (ventasActual / totalReservas) : 0;
        
        // --- Cálculo simple de RevPAR (Ingreso por Habitación Disponible) ---
        // Asume 30 habitaciones totales (total rooms) y 75% de ocupación para la simulación
        const totalRooms = 30; 
        const avgDailyRate = 122667; // Tasa diaria promedio (ADR) simulada
        const occupancyRate = 0.75; // Tasa de ocupación simulada
        const revPAR = avgDailyRate * occupancyRate;

        res.json({
            ventasNetas: ventasActual.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }),
            crecimiento: `${crecimiento.toFixed(1)}%`,
            ticketPromedio: ticketPromedio.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }),
            revPAR: revPAR.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }),
            revPARDetails: `Ocupación: ${(occupancyRate * 100).toFixed(0)}% | ADR: ${avgDailyRate.toLocaleString('es-CO')}`
        });

    } catch (error) {
        console.error('Error al obtener los KPIs de ventas:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener los KPIs.' });
    }
});


// =========================================================================
// RUTA GET para obtener el listado de Transacciones Recientes
// =========================================================================
router.get('/transacciones', async (req, res) => {
    try {
        const query = `
            SELECT 
                t.*,
                c.nombre AS nombre_cliente,
                c.apellido AS apellido_cliente,
                r.tipo_habitacion AS concepto_hab
            FROM 
                transacciones t
            LEFT JOIN 
                clientes c ON t.id_cliente = c.id
            LEFT JOIN
                reservas r ON t.id_reserva = r.id
            ORDER BY 
                t.fecha_transaccion DESC
            LIMIT 10 
        `;
        const [rows] = await pool.query(query);

        const formattedTransacciones = rows.map(formatTransaccion);

        res.json(formattedTransacciones);

    } catch (error) {
        console.error('Error al obtener las transacciones:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener las transacciones.' });
    }
});


module.exports = router;