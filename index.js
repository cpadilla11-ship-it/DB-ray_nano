// index.js - VERSIÓN FINAL (Aplicación Interactiva)
const inquirer = require('inquirer');
const { initConnection, executeQuery } = require('./db-connector');

// Importamos todas tus herramientas (incluyendo las stats)
const { 
    getTableColumns, 
    getPrimaryKey, 
    getUniqueConstraints, 
    getForeignKeys, 
    getTableStats 
} = require('./metadata-extractor');

const { generateDBML, saveDBMLFile } = require('./dbml-generator');
const { generateMarkdown, saveMarkdownFile } = require('./dictionary-generator');

// Importamos config para poder "engañarlo" y actualizar el nombre de la BD dinámicamente
const config = require('./config');

const SQL_LIST_TABLES = `
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
`;

async function main() {
    console.clear();
    console.log("=============================================");
    console.log("   🕵️  REVERSE ENGINEER TOOL - PORTABLE    ");
    console.log("   Genera Diagramas y Diccionarios de tu BD  ");
    console.log("=============================================\n");

    try {
        // 1. PREGUNTAS AL USUARIO (Interactividad)
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'host',
                message: 'Servidor (Host):',
                default: 'localhost'
            },
            {
                type: 'input',
                name: 'user',
                message: 'Usuario MySQL:',
                default: 'root'
            },
            {
                type: 'password',
                name: 'password',
                message: 'Contraseña MySQL:',
                mask: '*'
            },
            {
                type: 'input',
                name: 'database',
                message: 'Nombre de la Base de Datos a analizar:',
                validate: function(value) {
                    if (value.length) return true;
                    return 'Por favor ingresa el nombre de la base de datos.';
                }
            }
        ]);

        // 2. INICIAR CONEXIÓN
        console.log("\n🔌 Conectando...");
        await initConnection(answers);

        // TRUCO IMPORTANTE:
        // Actualizamos el objeto config en memoria para que 'metadata-extractor.js'
        // sepa qué base de datos usar sin tener que cambiar su código.
        config.db = {
            host: answers.host,
            user: answers.user,
            password: answers.password,
            database: answers.database
        };

        const dbName = answers.database;
        console.log(`🚀 Iniciando análisis de: ${dbName}`);

        // 3. LISTAR TABLAS
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [dbName]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);
        
        if (tableNames.length === 0) {
            console.log("⚠️ No se encontraron tablas en esta base de datos.");
            await pressAnyKeyToExit();
            return;
        }

        console.log(`✅ Tablas encontradas: ${tableNames.length}`);

        // 4. BUCLE DE EXTRACCIÓN (CORE + AVANZADO)
        const fullSchema = {};

        for (const tableName of tableNames) {
            process.stdout.write(`   Procesando: ${tableName}... `); 
            
            const [columns, pks, uniques, fks, stats] = await Promise.all([
                getTableColumns(tableName),
                getPrimaryKey(tableName),
                getUniqueConstraints(tableName),
                getForeignKeys(tableName),
                getTableStats(tableName)
            ]);

            fullSchema[tableName] = {
                columns: columns, 
                primaryKey: pks,
                uniqueKeys: uniques,
                foreignKeys: fks,
                stats: stats
            };
            console.log("OK");
        }

        // 5. GENERACIÓN DE ARCHIVOS
        console.log("\n📦 Generando archivos de salida...");
        
        // DBML
        const dbmlContent = generateDBML(fullSchema, dbName);
        saveDBMLFile(dbmlContent, `diagrama_${dbName}.dbml`);

        // Diccionario Markdown
        const mdContent = generateMarkdown(fullSchema, dbName);
        saveMarkdownFile(mdContent, `diccionario_${dbName}.md`);

        console.log("\n✨ ¡PROCESO TERMINADO CON ÉXITO! ✨");
        console.log("   Revisa la carpeta para ver tus archivos generados.");

    } catch (error) {
        console.error("\n❌ Ocurrió un error:", error.message);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error("   -> Verifica tu usuario y contraseña.");
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error("   -> Verifica el nombre de la base de datos.");
        } else if (error.code === 'ECONNREFUSED') {
            console.error("   -> Verifica que el servidor MySQL esté encendido y el Host sea correcto.");
        }
    } finally {
        // Pausa final para que la ventana no se cierre sola
        await pressAnyKeyToExit();
        process.exit(0);
    }
}

// Función auxiliar para esperar antes de cerrar
async function pressAnyKeyToExit() {
    console.log("\n");
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'exit', 
        message: 'Presiona ENTER para salir...' 
    }]);
}

main();