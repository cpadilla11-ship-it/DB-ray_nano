// db-connector.js
const mysql = require('mysql2/promise');

let pool = null; // La piscina empieza vacía

/**
 * Inicializa la conexión con las credenciales que de el usuario
 */
async function initConnection(userConfig) {
    try {
        pool = mysql.createPool({
            host: userConfig.host,
            user: userConfig.user,
            password: userConfig.password,
            database: userConfig.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        // Probamos la conexión inmediatamente
        await pool.getConnection(); 
        console.log("✅ ¡Conexión establecida correctamente!");
    } catch (error) {
        console.error("❌ Error al conectar. Verifica tus credenciales.");
        throw error; // Lanzamos el error para detener el programa
    }
}

async function executeQuery(sql, params = []) {
    if (!pool) throw new Error("La base de datos no ha sido inicializada.");
    
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(sql, params);
        return rows;
    } finally {
        connection.release();
    }
}

module.exports = { initConnection, executeQuery };