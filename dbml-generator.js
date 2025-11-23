// dbml-generator.js
const fs = require('fs');
const path = require('path');

/**
 * Genera el contenido DBML basado en el esquema extraído.
 * [cite: 53-64] - Especificaciones del Generador DBML
 */
function generateDBML(schema, databaseName) {
    let dbml = `// Generado automáticamente por ER Reverse Engineer\n`;
    dbml += `// Base de datos: ${databaseName}\n`;
    dbml += `// Fecha: ${new Date().toISOString().split('T')[0]}\n\n`;

    // 1. DEFINICIÓN DE TABLAS
    for (const [tableName, data] of Object.entries(schema)) {
        dbml += `Table ${tableName} {\n`;

        // Columnas
        data.columns.forEach(col => {
            let line = `  ${col.COLUMN_NAME} ${col.COLUMN_TYPE}`;
            
            // Configuraciones de la columna (Settings)
            let settings = [];
            
            // Es PK?
            if (data.primaryKey.includes(col.COLUMN_NAME)) {
                settings.push('pk');
            }
            
            // Es Unique? (Solo si no es PK, para no redundar)
            if (data.uniqueKeys.includes(col.COLUMN_NAME) && !data.primaryKey.includes(col.COLUMN_NAME)) {
                settings.push('unique');
            }
            
            // Not Null?
            if (col.IS_NULLABLE === 'NO') {
                settings.push('not null');
            }
            
            // Increment?
            if (col.EXTRA && col.EXTRA.includes('auto_increment')) {
                settings.push('increment');
            }

            // Nota / Comentario?
            if (col.COLUMN_COMMENT) {
                settings.push(`note: '${col.COLUMN_COMMENT}'`);
            }

            // Escribir settings si existen
            if (settings.length > 0) {
                line += ` [${settings.join(', ')}]`;
            }

            dbml += `${line}\n`;
        });

        dbml += `}\n\n`;
    }

    // 2. DEFINICIÓN DE RELACIONES (Refs)
    // [cite: 39-44] - Lógica de Cardinalidad
    dbml += `// Relaciones\n`;
    
    for (const [tableName, data] of Object.entries(schema)) {
        data.foreignKeys.forEach(fk => {
            // Lógica de Cardinalidad:
            // Si la FK es UNIQUE -> Relación 1:1 (-)
            // Si la FK NO es UNIQUE -> Relación 1:N (>)
            const isOneToOne = data.uniqueKeys.includes(fk.COLUMN_NAME);
            const relationSymbol = isOneToOne ? '-' : '>';

            let refLine = `Ref: ${tableName}.${fk.COLUMN_NAME} ${relationSymbol} ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`;
            
            // Agregar reglas de borrado si existen [cite: 277-281]
            if (fk.DELETE_RULE && fk.DELETE_RULE !== 'NO ACTION') {
                refLine += ` [delete: ${fk.DELETE_RULE.toLowerCase()}]`;
            }
            
            dbml += `${refLine}\n`;
        });
    }

    return dbml;
}

/**
 * Guarda el string DBML en un archivo.
 */
function saveDBMLFile(content, fileName = 'diagrama.dbml') {
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n💾 Archivo generado exitosamente: ${fileName}`);
    console.log(`👉 Puedes subirlo a https://dbdiagram.io/d para visualizarlo.`);
    return filePath;
}

module.exports = {
    generateDBML,
    saveDBMLFile
};