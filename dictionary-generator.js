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
    // ... (después del bucle for de las tablas) ...

    // --- SECCIÓN OPCIÓN E: OBJETOS ADICIONALES ---
    // Verificamos si existen los datos extra en el esquema global (schema.extra)
    
    if (schema.extra) {
        md += `\n# Objetos Adicionales de Base de Datos\n`;

        // 1. VISTAS
        if (schema.extra.views && schema.extra.views.length > 0) {
            md += `\n## Vistas (Views)\n`;
            schema.extra.views.forEach(v => {
                md += `### Vista: \`${v.TABLE_NAME}\`\n`;
                md += `- **Actualizable:** ${v.IS_UPDATABLE}\n`;
                md += `- **Definición SQL:**\n\`\`\`sql\n${v.VIEW_DEFINITION}\n\`\`\`\n\n`;
            });
        }

        // 2. TRIGGERS
        if (schema.extra.triggers && schema.extra.triggers.length > 0) {
            md += `\n## Triggers\n`;
            schema.extra.triggers.forEach(t => {
                md += `### Trigger: \`${t.TRIGGER_NAME}\`\n`;
                md += `- **Tabla Asociada:** \`${t.EVENT_OBJECT_TABLE}\`\n`;
                md += `- **Evento:** ${t.ACTION_TIMING} ${t.EVENT_MANIPULATION}\n`;
                md += `- **Código:**\n\`\`\`sql\n${t.ACTION_STATEMENT}\n\`\`\`\n\n`;
            });
        }

        // 3. STORED PROCEDURES
        if (schema.extra.procedures && schema.extra.procedures.length > 0) {
            md += `\n## Procedimientos Almacenados\n`;
            schema.extra.procedures.forEach(p => {
                md += `### Proc: \`${p.ROUTINE_NAME}\`\n`;
                
                // Tabla de parámetros
                if (p.parameters.length > 0) {
                    md += `**Parámetros:**\n`;
                    md += `| Modo | Nombre | Tipo |\n|---|---|---|\n`;
                    p.parameters.forEach(param => {
                        md += `| ${param.PARAMETER_MODE} | ${param.PARAMETER_NAME} | ${param.DTD_IDENTIFIER} |\n`;
                    });
                    md += `\n`;
                } else {
                    md += `> *Sin parámetros*\n`;
                }

                md += `**Definición:**\n\`\`\`sql\n${p.ROUTINE_DEFINITION}\n\`\`\`\n\n`;
            });
        }
    }

    return md;
}

function saveMarkdownFile(content, fileName = 'diccionario_datos.md') {
    // CAMBIAR ESTO:
    // const filePath = path.join(__dirname, fileName);

    // POR ESTO:
    const filePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n📘 Diccionario generado: ${fileName}`);
    return filePath;
}

module.exports = { generateMarkdown, saveMarkdownFile };