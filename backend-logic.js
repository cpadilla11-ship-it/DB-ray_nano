// NOMBRE DEL ARCHIVO: backend-logic.js
const { initConnection, executeQuery } = require('./db-connector');
const path = require('path');
const fs = require('fs');

// Importamos TODO del extractor (incluyendo el analizador)
const { 
    getTableColumns, getPrimaryKey, getUniqueConstraints, getForeignKeys, getTableStats, 
    getViews, getTriggers, getProcedures, analyzeCardinalities 
} = require('./metadata-extractor');

const { generateDBML } = require('./dbml-generator');
const { generateMarkdown } = require('./dictionary-generator');
const { 
    generateMermaid, generatePlantUML, generateDOT, generateSQL, generateJSON, generateGraphML 
} = require('./multiformat-generator');

async function runAnalysis(dbConfig, outputFolder) {
    try {
        console.log(`🔌 Conectando a ${dbConfig.host}...`);
        
        await initConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database
        });

        const dbName = dbConfig.database;
        const opts = dbConfig.options || {}; 

        // --- OBTENER TABLAS ---
        const SQL_LIST_TABLES = `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`;
        const tablesRaw = await executeQuery(SQL_LIST_TABLES, [dbName]);
        const tableNames = tablesRaw.map(t => t.TABLE_NAME);

        if (tableNames.length === 0) throw new Error("No se encontraron tablas.");

        const fullSchema = {};

        // --- EXTRACCIÓN DE DATOS CRUDOS ---
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

        // --- ANÁLISIS DE NEGOCIO (Cardinalidades) ---
        // Aquí es donde usamos la nueva función que movimos
        analyzeCardinalities(fullSchema);

        // --- EXTRACCIÓN EXTRA ---
        if (opts.extraObjects) {
            const [views, triggers, procs] = await Promise.all([
                getViews(dbName),
                getTriggers(dbName),
                getProcedures(dbName)
            ]);
            fullSchema.extra = { views, triggers, procedures: procs };
        }

        // --- GENERACIÓN ---
        let generatedFiles = [];

        // Core
        fs.writeFileSync(path.join(outputFolder, `diagrama_${dbName}.dbml`), generateDBML(fullSchema, dbName), 'utf8');
        fs.writeFileSync(path.join(outputFolder, `diccionario_${dbName}.md`), generateMarkdown(fullSchema, dbName), 'utf8');
        generatedFiles.push('DBML', 'Markdown');

        // Extras
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
            fs.writeFileSync(path.join(outputFolder, `diagrama_${dbName}.puml`), generatePlantUML(fullSchema), 'utf8');
            fs.writeFileSync(path.join(outputFolder, `diagrama_${dbName}.dot`), generateDOT(fullSchema), 'utf8');
            fs.writeFileSync(path.join(outputFolder, `diagrama_${dbName}.graphml`), generateGraphML(fullSchema), 'utf8');
            generatedFiles.push('PlantUML', 'DOT', 'GraphML');
        }

        return { success: true, message: `¡Éxito! Archivos generados: ${generatedFiles.join(', ')}` };

    } catch (error) {
        console.error("Error:", error);
        return { success: false, message: error.message || "Error desconocido" };
    }
}

module.exports = { runAnalysis };