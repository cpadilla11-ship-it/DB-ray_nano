// NOMBRE DEL ARCHIVO: index.js
const { executeQuery } = require('./db-connector');
// Importamos las 3 funciones (Columnas, PKs y Uniques)
const { getTableColumns, getPrimaryKey, getUniqueConstraints } = require('./metadata-extractor'); 
const config = require('./config');

// Query básica para listar las tablas [cite: 154-158]
const SQL_LIST_TABLES = `
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME;
`;

async function runReverseEngineer() {
    console.log("🚀 Iniciando ingeniería inversa (Paso 2 Completo)...");

    try {
        // 1. Obtener la lista de tablas
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [config.db.database]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);
        
        console.log(`✅ Tablas encontradas: ${tableNames.length}`);

        // Estructura global ("Objeto Gigante")
        const fullSchema = {};

        // 2. Bucle: Analizar cada tabla
        for (const tableName of tableNames) {
            process.stdout.write(`   Analizando tabla: ${tableName}... `); 
            
            // Ejecutamos las 3 consultas en paralelo (Promesas)
            const [columns, pks, uniques] = await Promise.all([
                getTableColumns(tableName),      // Trae columnas
                getPrimaryKey(tableName),        // Trae PKs
                getUniqueConstraints(tableName)  // Trae Uniques (NUEVO)
            ]);

            // Guardamos todo en el esquema global
            fullSchema[tableName] = {
                columns: columns, 
                primaryKey: pks,
                uniqueKeys: uniques // Guardamos las Uniques
            };
            
            console.log("OK");
        }

        console.log("\n✅ --- EXTRACCIÓN DE METADATOS COMPLETADA (20/20 pts CORE) ---");
        
        // 3. VERIFICACIÓN: Elegimos una tabla para mostrar resultados
        // Intentamos buscar 'carreras' (que tiene UNIQUE 'codigo') o usamos la primera que exista
        let testTable = 'carreras';
        if (!fullSchema[testTable]) {
            testTable = Object.keys(fullSchema)[0]; // Si no existe carreras, agarra la primera
        }
        
        if (testTable) {
            console.log(`\n🔎 Muestra de datos extraídos de la tabla '${testTable}':`);
            console.log("   🔑 Primary Key:", fullSchema[testTable].primaryKey);
            console.log("   🌟 Unique Keys:", fullSchema[testTable].uniqueKeys); // Debe salir ['codigo'] si usaste mi script SQL
            
            // Tabla visual de columnas
            console.table(fullSchema[testTable].columns.map(col => ({
                Nombre: col.COLUMN_NAME,
                Tipo: col.COLUMN_TYPE,
                Nulo: col.IS_NULLABLE
            })));
        }

    } catch (error) {
        console.error("\n❌ Error:", error);
    }
}

runReverseEngineer();