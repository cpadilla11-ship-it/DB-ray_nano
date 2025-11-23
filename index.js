// index.js
const { executeQuery } = require('./db-connector');
// Importamos las 4 funciones
const { getTableColumns, getPrimaryKey, getUniqueConstraints, getForeignKeys } = require('./metadata-extractor'); 
const config = require('./config');

const SQL_LIST_TABLES = `
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
`;

async function runReverseEngineer() {
    console.log("🚀 Iniciando ingeniería inversa (Paso 3: Relaciones)...");

    try {
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [config.db.database]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);
        console.log(`✅ Tablas encontradas: ${tableNames.length}`);

        const fullSchema = {};

        // --- BUCLE PRINCIPAL ---
        for (const tableName of tableNames) {
            process.stdout.write(`   Analizando tabla: ${tableName}... `); 
            
            // Ejecutamos las 4 promesas en paralelo
            const [columns, pks, uniques, fks] = await Promise.all([
                getTableColumns(tableName),
                getPrimaryKey(tableName),
                getUniqueConstraints(tableName),
                getForeignKeys(tableName) // <--- Aquí obtenemos las relaciones
            ]);

            fullSchema[tableName] = {
                columns: columns, 
                primaryKey: pks,
                uniqueKeys: uniques,
                foreignKeys: fks // <--- Las guardamos en memoria
            };
            console.log("OK");
        }

        console.log("\n✅ --- PROCESO COMPLETADO (CORE: Tablas + Columnas + Relaciones) ---");
        
        // --- VERIFICACIÓN VISUAL ---
        // Buscamos tablas que tengan relaciones para mostrarlas
        const tablesWithFK = Object.keys(fullSchema).filter(t => fullSchema[t].foreignKeys.length > 0);

        if (tablesWithFK.length > 0) {
            console.log(`\n🔗 Se detectaron relaciones en ${tablesWithFK.length} tablas.`);
            
            // Mostramos un ejemplo con la primera tabla que tenga relaciones
            const exampleTable = tablesWithFK[0]; 
            const data = fullSchema[exampleTable];

            console.log(`\n🔎 Detalle de Relaciones para la tabla '${exampleTable}':`);
            console.table(data.foreignKeys.map(fk => ({
                'Columna Local': fk.COLUMN_NAME,
                'Tipo Relación': 'FK ->',
                'Tabla Destino': fk.REFERENCED_TABLE_NAME,
                'Columna Destino': fk.REFERENCED_COLUMN_NAME,
                'Regla Delete': fk.DELETE_RULE // [cite: 27]
            })));
        } else {
            console.log("\n⚠️ No se detectaron relaciones (Foreign Keys). ¿Seguro que la BD tiene FKs creadas?");
        }

    } catch (error) {
        console.error("\n❌ Error:", error);
    }
}

runReverseEngineer();