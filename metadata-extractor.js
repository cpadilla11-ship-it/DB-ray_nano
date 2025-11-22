// NOMBRE DEL ARCHIVO: metadata-extractor.js
const { executeQuery } = require('./db-connector');
const config = require('./config');

/**
 * 1. Obtiene las columnas detalladas (Nombre, Tipo, Null, Default, Comentarios).
 * [cite: 161-167]
 */
async function getTableColumns(tableName) {
    const sql = `
        SELECT 
            COLUMN_NAME, 
            DATA_TYPE, 
            COLUMN_TYPE, 
            IS_NULLABLE, 
            COLUMN_DEFAULT, 
            COLUMN_COMMENT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION;
    `;
    return await executeQuery(sql, [config.db.database, tableName]);
}

/**
 * 2. Identifica la Primary Key (PK).
 * Retorna un array porque puede ser compuesta. [cite: 168-171]
 */
async function getPrimaryKey(tableName) {
    const sql = `
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION;
    `;
    const rows = await executeQuery(sql, [config.db.database, tableName]);
    return rows.map(row => row.COLUMN_NAME);
}

/**
 * 3. Identifica columnas con restricción UNIQUE.
 * Crítico para diferenciar relaciones 1:1 de 1:N más adelante. 
 */
async function getUniqueConstraints(tableName) {
    const sql = `
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME IN (
            SELECT CONSTRAINT_NAME
            FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = ?
              AND CONSTRAINT_TYPE = 'UNIQUE'
          );
    `;
    // Pasamos la BD y la tabla dos veces porque hay una subconsulta
    const rows = await executeQuery(sql, [config.db.database, tableName, config.db.database, tableName]);
    return rows.map(row => row.COLUMN_NAME);
}

module.exports = {
    getTableColumns,
    getPrimaryKey,
    getUniqueConstraints
};