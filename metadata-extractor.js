// NOMBRE DEL ARCHIVO: metadata-extractor.js
const { executeQuery } = require('./db-connector');

// Función auxiliar para saber en qué BD estamos conectados actualmente
async function getCurrentDB() {
    const rows = await executeQuery("SELECT DATABASE() as db");
    return rows[0].db;
}

async function getTableColumns(tableName) {
    const dbName = await getCurrentDB();
    const sql = `
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, EXTRA
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION;
    `;
    return await executeQuery(sql, [dbName, tableName]);
}

async function getPrimaryKey(tableName) {
    const dbName = await getCurrentDB();
    const sql = `
        SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION;
    `;
    const rows = await executeQuery(sql, [dbName, tableName]);
    return rows.map(r => r.COLUMN_NAME);
}

async function getUniqueConstraints(tableName) {
    const dbName = await getCurrentDB();
    const sql = `
        SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          AND CONSTRAINT_NAME IN (
            SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'UNIQUE'
          );
    `;
    const rows = await executeQuery(sql, [dbName, tableName, dbName, tableName]);
    return rows.map(r => r.COLUMN_NAME);
}

async function getForeignKeys(tableName) {
    const dbName = await getCurrentDB();
    const sql = `
        SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME, rc.UPDATE_RULE, rc.DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL;
    `;
    return await executeQuery(sql, [dbName, tableName]);
}

async function getTableStats(tableName) {
    const dbName = await getCurrentDB();
    const countSql = `SELECT COUNT(*) as total FROM \`${tableName}\``;
    const rowsCount = await executeQuery(countSql);
    
    const sizeSql = `
        SELECT ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS size_mb
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?;
    `;
    const rowsSize = await executeQuery(sizeSql, [dbName, tableName]);
    
    return {
        rowCount: rowsCount[0].total,
        sizeMB: rowsSize[0] ? rowsSize[0].size_mb : '0.00'
    };
}

async function getViews(dbName) {
    const sql = `SELECT TABLE_NAME, VIEW_DEFINITION, IS_UPDATABLE FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`;
    return await executeQuery(sql, [dbName]);
}

async function getTriggers(dbName) {
    const sql = `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?`;
    return await executeQuery(sql, [dbName]);
}

async function getProcedures(dbName) {
    const sqlProcs = `SELECT ROUTINE_NAME, ROUTINE_DEFINITION FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`;
    const procs = await executeQuery(sqlProcs, [dbName]);
    
    try {
        const sqlParams = `SELECT SPECIFIC_NAME, PARAMETER_MODE, PARAMETER_NAME, DTD_IDENTIFIER FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`;
        const params = await executeQuery(sqlParams, [dbName]);
        
        return procs.map(proc => ({
            ...proc,
            parameters: params.filter(p => p.SPECIFIC_NAME === proc.ROUTINE_NAME)
        }));
    } catch (e) {
        return procs.map(proc => ({ ...proc, parameters: [] }));
    }
}

/**
 * NUEVO: Procesamiento de lógica de negocio (Cardinalidades)
 * Modifica el objeto schema en su lugar (in-place).
 */
function analyzeCardinalities(schema) {
    for (const [tableName, table] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        // 1. Analizar Relaciones (1:1 vs 1:N)
        table.foreignKeys.forEach(fk => {
            const isUnique = table.uniqueKeys.includes(fk.COLUMN_NAME);
            fk.cardinality = isUnique ? '1:1 (Uno a Uno)' : '1:N (Uno a Muchos)';
            fk.isOneToOne = isUnique;
        });

        // 2. Detectar Tablas Asociativas (N:M)
        const pkCols = table.primaryKey;
        const fkCols = table.foreignKeys.map(fk => fk.COLUMN_NAME);

        const isCompositePK = pkCols.length >= 2;
        const allPkAreFks = pkCols.length > 0 && pkCols.every(pk => fkCols.includes(pk));

        if (isCompositePK && allPkAreFks) {
            table.isAssociative = true;
            table.relationshipType = 'N:M (Muchos a Muchos)';
            const connectedTables = table.foreignKeys.map(fk => fk.REFERENCED_TABLE_NAME);
            table.associativeInfo = `Conecta: ${connectedTables.join(' <-> ')}`;
        } else {
            table.isAssociative = false;
        }
    }
}

module.exports = {
    getTableColumns, getPrimaryKey, getUniqueConstraints, getForeignKeys, getTableStats,
    getViews, getTriggers, getProcedures, analyzeCardinalities // <--- Exportamos la nueva función
};