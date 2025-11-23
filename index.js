// index.js
const { executeQuery } = require('./db-connector');
const { getTableColumns, getPrimaryKey, getUniqueConstraints, getForeignKeys } = require('./metadata-extractor'); 
const { generateDBML, saveDBMLFile } = require('./dbml-generator'); // <--- IMPORTAR GENERADOR
const config = require('./config');

const SQL_LIST_TABLES = `
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
`;

async function runReverseEngineer() {
    console.log("🚀 Iniciando ingeniería inversa (Generación DBML)...");

    try {
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [config.db.database]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);
        console.log(`✅ Tablas encontradas: ${tableNames.length}`);

        const fullSchema = {};

        for (const tableName of tableNames) {
            process.stdout.write(`   Analizando tabla: ${tableName}... `); 
            const [columns, pks, uniques, fks] = await Promise.all([
                getTableColumns(tableName),
                getPrimaryKey(tableName),
                getUniqueConstraints(tableName),
                getForeignKeys(tableName)
            ]);

            fullSchema[tableName] = {
                columns: columns, 
                primaryKey: pks,
                uniqueKeys: uniques,
                foreignKeys: fks 
            };
            console.log("OK");
        }

        console.log("\n✅ --- EXTRACCIÓN COMPLETADA ---");

        // --- PASO 4: GENERAR ARCHIVO DBML ---
        console.log("\n📝 Generando código DBML...");
        
        const dbmlContent = generateDBML(fullSchema, config.db.database);
        saveDBMLFile(dbmlContent, 'mi_diagrama.dbml'); // <--- Guarda el archivo

    } catch (error) {
        console.error("\n❌ Error:", error);
    }
}

runReverseEngineer();