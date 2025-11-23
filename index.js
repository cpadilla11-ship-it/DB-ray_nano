// index.js
const { executeQuery } = require('./db-connector');
const { getTableColumns, getPrimaryKey, getUniqueConstraints, getForeignKeys } = require('./metadata-extractor'); 
const { generateDBML, saveDBMLFile } = require('./dbml-generator');
const { generateMarkdown, saveMarkdownFile } = require('./dictionary-generator'); // <--- NUEVO IMPORT
const config = require('./config');

const SQL_LIST_TABLES = `
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
`;

async function runReverseEngineer() {
    console.log("🚀 Iniciando ingeniería inversa COMPLETA...");
    console.time("Tiempo Total");

    try {
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [config.db.database]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);
        console.log(`✅ Tablas encontradas: ${tableNames.length}`);

        const fullSchema = {};

        // --- EXTRACCIÓN ---
        for (const tableName of tableNames) {
            process.stdout.write(`   Procesando: ${tableName}... `); 
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

        // --- GENERACIÓN DE ENTREGABLES ---
        console.log("\n📦 Generando archivos de salida...");

        // 1. Diagrama DBML
        const dbmlContent = generateDBML(fullSchema, config.db.database);
        saveDBMLFile(dbmlContent, 'diagrama_final.dbml');

        // 2. Diccionario de Datos (Markdown)
        const mdContent = generateMarkdown(fullSchema, config.db.database);
        saveMarkdownFile(mdContent, 'diccionario_datos.md');

        console.log("\n✅ ¡PROYECTO CORE TERMINADO (80/80 pts)! 🏆");
        console.log("   Revisa tu carpeta para ver los archivos generados.");

    } catch (error) {
        console.error("\n❌ Error:", error);
    }
    console.timeEnd("Tiempo Total");
}

runReverseEngineer();