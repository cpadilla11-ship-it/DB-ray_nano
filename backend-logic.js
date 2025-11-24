// NOMBRE DEL ARCHIVO: backend-logic.js

const { initConnection, executeQuery } = require('./db-connector');
const path = require('path');
const fs = require('fs');

// 1. IMPORTAR HERRAMIENTAS DE EXTRACCIÓN (CORE + OPCIONES D y E)
const { 
    getTableColumns, 
    getPrimaryKey, 
    getUniqueConstraints, 
    getForeignKeys, 
    getTableStats, // Opción D
    getViews,      // Opción E
    getTriggers,   // Opción E
    getProcedures  // Opción E
} = require('./metadata-extractor');

// 2. IMPORTAR GENERADORES (CORE)
const { generateDBML } = require('./dbml-generator');
const { generateMarkdown } = require('./dictionary-generator');

// 3. IMPORTAR GENERADORES ADICIONALES (OPCIÓN F)
const { 
    generateMermaid, 
    generatePlantUML, 
    generateDOT, 
    generateSQL, 
    generateJSON 
} = require('./multiformat-generator');

/**
 * Función principal que ejecuta todo el análisis.
 * Llamada desde el proceso principal de Electron (main.js).
 */
async function runAnalysis(dbConfig, outputFolder) {
    try {
        // --- 1. CONEXIÓN ---
        console.log(`🔌 Conectando a ${dbConfig.host}...`);
        await initConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database
        });

        const dbName = dbConfig.database;
        const opts = dbConfig.options || {}; // Opciones seleccionadas por el usuario (checkboxes)

        // --- 2. OBTENER LISTA DE TABLAS ---
        const SQL_LIST_TABLES = `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`;
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [dbName]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);

        if (tableNames.length === 0) throw new Error("No se encontraron tablas en la base de datos.");

        // Objeto gigante donde guardaremos todo
        const fullSchema = {};

        // --- 3. BUCLE PRINCIPAL (CORE + ESTADÍSTICAS) ---
        for (const tableName of tableNames) {
            // Ejecutamos todas las extracciones en paralelo para velocidad
            const [columns, pks, uniques, fks, stats] = await Promise.all([
                getTableColumns(tableName),      // Columnas
                getPrimaryKey(tableName),        // PKs
                getUniqueConstraints(tableName), // Uniques (1:1 vs 1:N)
                getForeignKeys(tableName),       // FKs (Relaciones)
                getTableStats(tableName)         // Estadísticas (Opción D)
            ]);

            fullSchema[tableName] = { 
                columns, 
                primaryKey: pks, 
                uniqueKeys: uniques, 
                foreignKeys: fks, 
                stats 
            };
        }

        // --- 4. EXTRACCIÓN DE OBJETOS EXTRA (OPCIÓN E) ---
        // Solo si el usuario marcó el checkbox "Extra Objects"
        if (opts.extraObjects) {
            const [views, triggers, procs] = await Promise.all([
                getViews(dbName),
                getTriggers(dbName),
                getProcedures(dbName)
            ]);

            // Los guardamos en una propiedad especial 'extra'
            fullSchema.extra = {
                views: views,
                triggers: triggers,
                procedures: procs
            };
        }

        // --- 5. GENERACIÓN DE ARCHIVOS ---
        let generatedFiles = [];

        // A. ARCHIVOS CORE (Siempre se generan)
        // ----------------------------------------------------
        const dbmlPath = path.join(outputFolder, `diagrama_${dbName}.dbml`);
        const mdPath = path.join(outputFolder, `diccionario_${dbName}.md`);
        
        fs.writeFileSync(dbmlPath, generateDBML(fullSchema, dbName), 'utf8');
        fs.writeFileSync(mdPath, generateMarkdown(fullSchema, dbName), 'utf8'); // Ahora incluye Opción E si existe
        generatedFiles.push('DBML', 'Markdown');

        // B. ARCHIVOS OPCIONALES (OPCIÓN F - Según checkboxes)
        // ----------------------------------------------------
        if (opts.mermaid) {
            fs.writeFileSync(path.join(outputFolder, `diagrama_${dbName}.mermaid`), generateMermaid(fullSchema), 'utf8');
            generatedFiles.push('Mermaid');
        }

        if (opts.sql) {
            fs.writeFileSync(path.join(outputFolder, `schema_${dbName}.sql`), generateSQL(fullSchema), 'utf8');
            generatedFiles.push('SQL');
        }

        if (opts.json) {
            fs.writeFileSync(path.join(outputFolder, `schema_${dbName}.json`), generateJSON(fullSchema), 'utf8');
            generatedFiles.push('JSON');
        }

        if (opts.plantuml) {
            // PlantUML y DOT suelen ir juntos
            fs.writeFileSync(path.join(outputFolder, `diagrama_${dbName}.puml`), generatePlantUML(fullSchema), 'utf8');
            fs.writeFileSync(path.join(outputFolder, `diagrama_${dbName}.dot`), generateDOT(fullSchema), 'utf8');
            generatedFiles.push('PlantUML', 'DOT');
        }

        // --- 6. RETORNAR ÉXITO ---
        return { 
            success: true, 
            message: `¡Proceso Exitoso!\nArchivos generados: ${generatedFiles.join(', ')}\nUbicación: ${outputFolder}` 
        };

    } catch (error) {
        console.error("Error en backend-logic:", error);
        return { 
            success: false, 
            message: error.message || error.sqlMessage || "Error desconocido al procesar la BD." 
        };
    }
}

module.exports = { runAnalysis };