// dictionary-generator.js
const fs = require('fs');
const path = require('path');

function generateMarkdown(schema, databaseName) {
    const date = new Date().toLocaleDateString();
    let md = `# Diccionario de Datos: ${databaseName}\n`;
    md += `**Fecha de generación:** ${date}\n\n`;
    
    // --- RESUMEN EJECUTIVO (Con totales globales) ---
    md += `## Resumen Ejecutivo\n`;
    const tableCount = Object.keys(schema).length;
    const relationCount = Object.values(schema).reduce((acc, t) => acc + t.foreignKeys.length, 0);
    
    // Calculamos totales sumando las estadísticas de cada tabla
    let totalRecords = 0;
    let totalSize = 0.0;
    
    Object.values(schema).forEach(t => {
        // Validamos que existan las stats para no romper el código
        if (t.stats) {
            totalRecords += t.stats.rowCount;
            totalSize += parseFloat(t.stats.sizeMB || 0);
        }
    });

    md += `* **Total de Tablas:** ${tableCount}\n`;
    md += `* **Total de Relaciones:** ${relationCount}\n`;
    md += `* **Registros Totales:** ${totalRecords}\n`;
    md += `* **Tamaño Total:** ${totalSize.toFixed(2)} MB\n`;
    md += `\n---\n`;

    // --- DETALLE POR TABLA ---
    for (const [tableName, data] of Object.entries(schema)) {
        md += `## Tabla: \`${tableName}\`\n`;
        
        // 👇 ¡AQUÍ ESTÁ LA LÍNEA QUE FALTABA! 👇
        if (data.stats) {
            md += `> **Estadísticas:** ${data.stats.rowCount} registros | ${data.stats.sizeMB} MB\n\n`;
        }

        // 1. Columnas
        md += `### Columnas\n`;
        md += `| Nombre | Tipo | Nulo | Default | Detalles |\n`;
        md += `|---|---|---|---|---|\n`;
        
        data.columns.forEach(col => {
            let detalles = [];
            if (data.primaryKey.includes(col.COLUMN_NAME)) detalles.push('🔑 **PK**');
            if (data.foreignKeys.some(fk => fk.COLUMN_NAME === col.COLUMN_NAME)) detalles.push('🔗 **FK**');
            if (data.uniqueKeys.includes(col.COLUMN_NAME)) detalles.push('🌟 Unique');
            
            const detailStr = detalles.join(', ');
            const defVal = col.COLUMN_DEFAULT === null ? '*NULL*' : `\`${col.COLUMN_DEFAULT}\``;
            
            md += `| **${col.COLUMN_NAME}** | \`${col.COLUMN_TYPE}\` | ${col.IS_NULLABLE} | ${defVal} | ${detailStr} |\n`;
        });

        // 2. Relaciones
        if (data.foreignKeys.length > 0) {
            md += `\n### Relaciones (Foreign Keys)\n`;
            md += `| Columna Local | Referencia a | Regla Borrado |\n`;
            md += `|---|---|---|\n`;
            
            data.foreignKeys.forEach(fk => {
                md += `| ${fk.COLUMN_NAME} | \`${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\` | ${fk.DELETE_RULE} |\n`;
            });
        } else {
            md += `\n> *Esta tabla no tiene claves foráneas (no depende de otras).*\n`;
        }

        md += `\n---\n`;
    }

    return md;
}

function saveMarkdownFile(content, fileName = 'diccionario_datos.md') {
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n📘 Diccionario generado: ${fileName}`);
    return filePath;
}

module.exports = { generateMarkdown, saveMarkdownFile };