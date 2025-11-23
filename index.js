// index.js (Solo la parte del bucle necesita cambio, pero aquí está el contexto)
const { executeQuery } = require('./db-connector');
// Importamos AHORA 5 funciones
const { getTableColumns, getPrimaryKey, getUniqueConstraints, getForeignKeys, getTableStats } = require('./metadata-extractor'); 
const { generateDBML, saveDBMLFile } = require('./dbml-generator');
const { generateMarkdown, saveMarkdownFile } = require('./dictionary-generator');
const config = require('./config');

const SQL_LIST_TABLES = `
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
`;

async function runReverseEngineer() {
    console.log("🚀 Iniciando ingeniería inversa (CON ESTADÍSTICAS)...");
    
    try {
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [config.db.database]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);
        console.log(`✅ Tablas encontradas: ${tableNames.length}`);

        const fullSchema = {};

        for (const tableName of tableNames) {
            process.stdout.write(`   Procesando: ${tableName}... `); 
            
            // AHORA SON 5 PROMESAS EN PARALELO
            const [columns, pks, uniques, fks, stats] = await Promise.all([
                getTableColumns(tableName),
                getPrimaryKey(tableName),
                getUniqueConstraints(tableName),
                getForeignKeys(tableName),
                getTableStats(tableName) // <--- ¡Nuevo!
            ]);

            fullSchema[tableName] = {
                columns: columns, 
                primaryKey: pks,
                uniqueKeys: uniques,
                foreignKeys: fks,
                stats: stats // <--- Guardamos las estadísticas
            };
            console.log("OK");
        }

        // --- GENERACIÓN ---
        console.log("\n📦 Generando reportes...");
        
        const dbmlContent = generateDBML(fullSchema, config.db.database);
        saveDBMLFile(dbmlContent, 'diagrama_final.dbml');

        const mdContent = generateMarkdown(fullSchema, config.db.database);
        saveMarkdownFile(mdContent, 'diccionario_datos.md');

        console.log("\n✨ ¡PROYECTO TERMINADO (CORE + AVANZADO)! ✨");

    } catch (error) {
        console.error("\n❌ Error:", error);
    }
}

runReverseEngineer();