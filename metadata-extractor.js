// metadata-extractor.js
const { executeQuery } = require('./db-connector');
const config = require('./config');

/**
 * 1. Obtiene columnas (Ya lo tenías)
 */
async function getTableColumns(tableName) {
    const sql = `
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION;
    `;
    return await executeQuery(sql, [config.db.database, tableName]);
}

/**
 * 2. Obtiene PKs (Ya lo tenías)
 */
async function getPrimaryKey(tableName) {
    const sql = `
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION;
    `;
    const rows = await executeQuery(sql, [config.db.database, tableName]);
    return rows.map(r => r.COLUMN_NAME);
}

/**
 * 3. Obtiene Unique Constraints (Ya lo tenías - Vital para 1:1)
 */
async function getUniqueConstraints(tableName) {
    const sql = `
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          AND CONSTRAINT_NAME IN (
            SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'UNIQUE'
          );
    `;
    const rows = await executeQuery(sql, [config.db.database, tableName, config.db.database, tableName]);
    return rows.map(r => r.COLUMN_NAME);
}

/**
 * 4. (NUEVO) Obtiene Foreign Keys y Reglas de Integridad.
 * Implementa la lógica de la Query 4 del documento de apoyo [cite: 498-508].
 * Une KEY_COLUMN_USAGE con REFERENTIAL_CONSTRAINTS.
 */
async function getForeignKeys(tableName) {
    const sql = `
        SELECT 
            kcu.CONSTRAINT_NAME,
            kcu.COLUMN_NAME,              -- Columna origen (Hija)
            kcu.REFERENCED_TABLE_NAME,    -- Tabla destino (Padre)
            kcu.REFERENCED_COLUMN_NAME,   -- Columna destino (Padre)
            rc.UPDATE_RULE,               -- Regla al actualizar
            rc.DELETE_RULE                -- Regla al borrar (CASCADE, RESTRICT, etc.)
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
            AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        WHERE kcu.TABLE_SCHEMA = ? 
          AND kcu.TABLE_NAME = ?
          AND kcu.REFERENCED_TABLE_NAME IS NOT NULL; -- Solo nos interesan las FKs
    `;
    
    return await executeQuery(sql, [config.db.database, tableName]);
}
/**
 * 5. (AVANZADO - Opción D) CORREGIDO
 * Cuenta registros reales y calcula el tamaño en disco.
 [cite_start]* [cite: 110-114, 451-460]
 */
async function getTableStats(tableName) {
    // 1. Contar registros reales (Cardinalidad exacta)
    // CORRECCIÓN: Usamos template strings `...` para insertar el nombre de la tabla directamente.
    // Esto evita el error con .execute()
    const countSql = `SELECT COUNT(*) as total FROM \`${tableName}\``;
    
    // Nota: Ya no enviamos [tableName] como segundo parámetro
    const rowsCount = await executeQuery(countSql);
    const totalRows = rowsCount[0].total;

    // 2. Calcular tamaño en MB desde information_schema
    // Aquí sí podemos usar ? porque estamos comparando valores (strings), no nombres de tablas
    const sizeSql = `
        SELECT ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS size_mb
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?;
    `;
    const rowsSize = await executeQuery(sizeSql, [config.db.database, tableName]);
    const sizeMB = rowsSize[0] ? rowsSize[0].size_mb : '0.00';

    return {
        rowCount: totalRows,
        sizeMB: sizeMB
    };
}

module.exports = {
    getTableColumns,
    getPrimaryKey,
    getUniqueConstraints,
    getForeignKeys, // <--- ¡Asegúrate de que esto esté aquí!
    getTableStats // <--- ¡Asegúrate de que esta línea esté aquí!
};