// dbml-generator.js
const fs = require('fs');
const path = require('path');

/**
 * Genera el contenido DBML basado en el esquema extraído.
 * VERSIÓN CORREGIDA: Agrega comillas "" a los nombres para evitar errores de sintaxis.
 */
function generateDBML(schema, databaseName) {
    let dbml = `// Generado automáticamente por ER Reverse Engineer\n`;
    dbml += `// Base de datos: ${databaseName}\n`;
    dbml += `// Fecha: ${new Date().toISOString().split('T')[0]}\n\n`;

    // 1. DEFINICIÓN DE TABLAS
    for (const [tableName, data] of Object.entries(schema)) {
        // CORRECCIÓN: Comillas en el nombre de la tabla
        dbml += `Table "${tableName}" {\n`;

        // Columnas
        data.columns.forEach(col => {
            // CORRECCIÓN: Comillas en el nombre de la columna
            let line = `  "${col.COLUMN_NAME}" ${col.COLUMN_TYPE}`;

            // Configuraciones de la columna (Settings)
            let settings = [];

            // Es PK?
            if (data.primaryKey.includes(col.COLUMN_NAME)) {
                settings.push('pk');
            }

            // Es Unique? (Solo si no es PK)
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
                // Escapamos comillas simples dentro del comentario
                const cleanComment = col.COLUMN_COMMENT.replace(/'/g, "\\'");
                settings.push(`note: '${cleanComment}'`);
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
    dbml += `// Relaciones\n`;

    for (const [tableName, data] of Object.entries(schema)) {
        data.foreignKeys.forEach(fk => {
            const isOneToOne = data.uniqueKeys.includes(fk.COLUMN_NAME);
            const relationSymbol = isOneToOne ? '-' : '>';

            // CORRECCIÓN: Comillas en TODAS las partes de la referencia
            let refLine = `Ref: "${tableName}"."${fk.COLUMN_NAME}" ${relationSymbol} "${fk.REFERENCED_TABLE_NAME}"."${fk.REFERENCED_COLUMN_NAME}"`;

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
    // CAMBIAR ESTO:
    // const filePath = path.join(__dirname, fileName);

    // POR ESTO (Permite guardar el archivo fuera del exe):
    const filePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n💾 Archivo DBML generado exitosamente: ${fileName}`);
    return filePath;
}

module.exports = {
    generateDBML,
    saveDBMLFile
};