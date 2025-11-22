// db-connector.js
const mysql = require('mysql2/promise'); // Importa la versión que soporta Promesas
const config = require('./config');

// db-connector.js

// Crear el Pool de Conexiones
const pool = mysql.createPool(config.db);

/**
 * Función genérica para ejecutar una query SQL
 * @param {string} sql La sentencia SQL a ejecutar.
 * @param {Array} params Parámetros a ser pasados a la query (previene inyección SQL).
 * @returns {Promise<Array>} Los resultados de la query.
 */
async function executeQuery(sql, params = []) {
    let connection;
    try {
        // Obtener una conexión del pool
        connection = await pool.getConnection(); 

        // Ejecutar la query
        const [rows] = await connection.execute(sql, params);
        return rows;

    } catch (error) {
        console.error("Error ejecutando query:", error);
        throw error; // Propagar el error para manejarlo en el llamador
    } finally {
        // Asegurarse de liberar la conexión de vuelta al pool
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    executeQuery
};