// dbml-generator.js
const fs = require('fs');
const path = require('path');

function generateDBML(schema, databaseName) {
    let dbml = `// Generado automáticamente por ER Reverse Engineer\n`;
    dbml += `// Base de datos: ${databaseName}\n`;
    dbml += `// Fecha: ${new Date().toISOString().split('T')[0]}\n\n`;

    // 1. DEFINICIÓN DE TABLAS
    for (const [tableName, data] of Object.entries(schema)) {
        // 🛑 CORRECCIÓN: Ignoramos la metadata extra (vistas, triggers)
        if (tableName === 'extra') continue;

        dbml += `Table "${tableName}" {\n`;

        // Columnas
        data.columns.forEach(col => {
            let line = `  "${col.COLUMN_NAME}" ${col.COLUMN_TYPE}`;
            let settings = [];
            
            if (data.primaryKey.includes(col.COLUMN_NAME)) settings.push('pk');
            if (data.uniqueKeys.includes(col.COLUMN_NAME) && !data.primaryKey.includes(col.COLUMN_NAME)) settings.push('unique');
            if (col.IS_NULLABLE === 'NO') settings.push('not null');
            if (col.EXTRA && col.EXTRA.includes('auto_increment')) settings.push('increment');
            if (col.COLUMN_COMMENT) {
                const cleanComment = col.COLUMN_COMMENT.replace(/'/g, "\\'");
                settings.push(`note: '${cleanComment}'`);
            }

            if (settings.length > 0) line += ` [${settings.join(', ')}]`;
            dbml += `${line}\n`;
        });

        dbml += `}\n\n`;
    }

    // 2. RELACIONES
    dbml += `// Relaciones\n`;
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue; // 🛑 También aquí

        data.foreignKeys.forEach(fk => {
            const isOneToOne = data.uniqueKeys.includes(fk.COLUMN_NAME);
            const relationSymbol = isOneToOne ? '-' : '>';
            let refLine = `Ref: "${tableName}"."${fk.COLUMN_NAME}" ${relationSymbol} "${fk.REFERENCED_TABLE_NAME}"."${fk.REFERENCED_COLUMN_NAME}"`;
            
            if (fk.DELETE_RULE && fk.DELETE_RULE !== 'NO ACTION') {
                refLine += ` [delete: ${fk.DELETE_RULE.toLowerCase()}]`;
            }
            dbml += `${refLine}\n`;
        });
    }

    return dbml;
}

function saveDBMLFile(content, fileName = 'diagrama.dbml') {
    // Usamos process.cwd() para compatibilidad con .exe
    const filePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

module.exports = { generateDBML, saveDBMLFile };