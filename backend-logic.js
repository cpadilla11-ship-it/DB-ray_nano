// backend-logic.js
const { initConnection, executeQuery } = require('./db-connector');
const { getTableColumns, getPrimaryKey, getUniqueConstraints, getForeignKeys, getTableStats } = require('./metadata-extractor');
const { generateDBML, saveDBMLFile } = require('./dbml-generator');
const { generateMarkdown, saveMarkdownFile } = require('./dictionary-generator');
const config = require('./config');
const path = require('path');
const fs = require('fs');

// Esta función será llamada desde la ventana de Electron
async function runAnalysis(dbConfig, outputFolder) {
    try {
        // 1. Configurar conexión
        await initConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database
        });

        // Actualizar config en memoria
        config.db = dbConfig;
        const dbName = dbConfig.database;

        // 2. Obtener tablas
        const SQL_LIST_TABLES = `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`;
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [dbName]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);

        if (tableNames.length === 0) throw new Error("No se encontraron tablas.");

        const fullSchema = {};

        // 3. Procesar tablas
        for (const tableName of tableNames) {
            const [columns, pks, uniques, fks, stats] = await Promise.all([
                getTableColumns(tableName),
                getPrimaryKey(tableName),
                getUniqueConstraints(tableName),
                getForeignKeys(tableName),
                getTableStats(tableName)
            ]);

            fullSchema[tableName] = { columns, primaryKey: pks, uniqueKeys: uniques, foreignKeys: fks, stats };
        }

        // 4. Generar archivos (Usando la carpeta seleccionada o el Escritorio)
        // Sobrescribimos la función save para usar la ruta que nos da Electron
        const dbmlPath = path.join(outputFolder, `diagrama_${dbName}.dbml`);
        const mdPath = path.join(outputFolder, `diccionario_${dbName}.md`);

        fs.writeFileSync(dbmlPath, generateDBML(fullSchema, dbName), 'utf8');
        fs.writeFileSync(mdPath, generateMarkdown(fullSchema, dbName), 'utf8');

        return { success: true, message: `Archivos generados en: ${outputFolder}` };

    } catch (error) {
        console.error(error);
        return { success: false, message: error.message || error.sqlMessage };
    }
}

module.exports = { runAnalysis };