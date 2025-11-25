// NOMBRE DEL ARCHIVO: dictionary-generator.js
const fs = require('fs');
const path = require('path');

function generateMarkdown(schema, databaseName) {
    const date = new Date().toLocaleDateString();
    let md = `# Diccionario de Datos: ${databaseName}\n`;
    md += `**Fecha de generación:** ${date}\n\n`;
    
    // 1. RESUMEN EJECUTIVO
    // Filtramos 'extra' para contar solo tablas reales
    const realTables = Object.keys(schema).filter(k => k !== 'extra');
    
    let relationCount = 0;
    let totalRecords = 0;
    let totalSize = 0.0;
    
    realTables.forEach(t => {
        const data = schema[t];
        relationCount += data.foreignKeys.length;
        if (data.stats) {
            totalRecords += data.stats.rowCount;
            totalSize += parseFloat(data.stats.sizeMB || 0);
        }
    });

    md += `## Resumen Ejecutivo\n`;
    md += `* **Total de Tablas:** ${realTables.length}\n`;
    md += `* **Total de Relaciones:** ${relationCount}\n`;
    md += `* **Registros Totales:** ${totalRecords}\n`;
    md += `* **Tamaño Total:** ${totalSize.toFixed(2)} MB\n`;
    md += `\n---\n`;

    // 2. DETALLE DE TABLAS (CORE)
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        md += `## Tabla: \`${tableName}\`\n`;
        
        // Etiqueta de tabla asociativa
        if (data.isAssociative) {
            md += `> 🔄 **TABLA ASOCIATIVA (N:M)**\n> ${data.associativeInfo}\n\n`;
        }

        // Estadísticas
        if (data.stats) {
            md += `> **Estadísticas:** ${data.stats.rowCount} registros | ${data.stats.sizeMB} MB\n\n`;
        }

        // Columnas
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

        // Relaciones
        if (data.foreignKeys.length > 0) {
            md += `\n### Relaciones (Foreign Keys)\n`;
            md += `| Columna Local | Referencia a | Card. | Regla Borrado |\n`;
            md += `|---|---|---|---|\n`;
            
            data.foreignKeys.forEach(fk => {
                const card = fk.cardinality || '1:N';
                md += `| ${fk.COLUMN_NAME} | \`${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\` | ${card} | ${fk.DELETE_RULE} |\n`;
            });
        } else {
            md += `\n> *Esta tabla no tiene claves foráneas.*\n`;
        }

        md += `\n---\n`;
    }

    // 3. OBJETOS ADICIONALES (OPCIÓN E)
    if (schema.extra) {
        md += `\n# Objetos Adicionales de Base de Datos\n`;
        let hasExtras = false;

        // A. Vistas
        if (schema.extra.views && schema.extra.views.length > 0) {
            hasExtras = true;
            md += `\n## 👁️ Vistas (Views)\n`;
            schema.extra.views.forEach(v => {
                md += `### Vista: \`${v.TABLE_NAME}\`\n`;
                md += `- **Actualizable:** ${v.IS_UPDATABLE}\n`;
                md += `- **Definición SQL:**\n\`\`\`sql\n${v.VIEW_DEFINITION}\n\`\`\`\n\n`;
            });
        }

        // B. Triggers
        if (schema.extra.triggers && schema.extra.triggers.length > 0) {
            hasExtras = true;
            md += `\n## ⚡ Triggers\n`;
            schema.extra.triggers.forEach(t => {
                md += `### Trigger: \`${t.TRIGGER_NAME}\`\n`;
                md += `- **Tabla:** \`${t.EVENT_OBJECT_TABLE}\`\n`;
                md += `- **Evento:** ${t.ACTION_TIMING} ${t.EVENT_MANIPULATION}\n`;
                md += `- **Código:**\n\`\`\`sql\n${t.ACTION_STATEMENT}\n\`\`\`\n\n`;
            });
        }

        // C. Procedimientos Almacenados
        if (schema.extra.procedures && schema.extra.procedures.length > 0) {
            hasExtras = true;
            md += `\n## ⚙️ Procedimientos Almacenados\n`;
            schema.extra.procedures.forEach(p => {
                md += `### Proc: \`${p.ROUTINE_NAME}\`\n`;
                
                if (p.parameters && p.parameters.length > 0) {
                    md += `**Parámetros:**\n`;
                    md += `| Modo | Nombre | Tipo |\n|---|---|---|\n`;
                    p.parameters.forEach(param => {
                        md += `| ${param.PARAMETER_MODE} | ${param.PARAMETER_NAME} | ${param.DTD_IDENTIFIER} |\n`;
                    });
                    md += `\n`;
                }
                
                if (p.ROUTINE_DEFINITION) {
                    md += `**Definición:**\n\`\`\`sql\n${p.ROUTINE_DEFINITION}\n\`\`\`\n\n`;
                }
            });
        }

        if (!hasExtras) {
            md += `> *No se encontraron Vistas, Triggers ni Procedimientos en esta BD.*\n`;
        }
    }

    return md;
}

function saveMarkdownFile(content, fileName = 'diccionario_datos.md') {
    // Usamos process.cwd() para compatibilidad con .exe
    const filePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

module.exports = { generateMarkdown, saveMarkdownFile };