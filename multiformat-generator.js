// NOMBRE DEL ARCHIVO: multiformat-generator.js (VERSIÓN CORREGIDA)

/**
 * Genera formatos adicionales para diagramas de base de datos.
 * CORRECCIONES APLICADAS:
 * - Mermaid: Labels vacíos y tipos limpios
 * - PlantUML: Sintaxis correcta de entidades
 * - DOT: Escape de caracteres especiales
 * - GraphML: Definición de keys
 * - SQL: Escape de valores DEFAULT
 */

// ============================================================================
// 1. MERMAID (CORREGIDO)
// ============================================================================
function generateMermaid(schema) {
    let content = `erDiagram\n`;
    
    // Entidades
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        content += `  "${tableName}" {\n`;
        data.columns.forEach(col => {
            // Limpiar tipo de datos (sin paréntesis, espacios ni comas)
            let cleanType = (col.COLUMN_TYPE || col.DATA_TYPE || 'string')
                .replace(/\s+/g, '_')       // Espacios -> _
                .replace(/[()]/g, '_')      // Paréntesis -> _
                .replace(/,/g, '_')         // Comas -> _
                .replace(/_+/g, '_')        // Eliminar dobles guiones
                .replace(/^_|_$/g, '');     // Eliminar guiones al inicio/final

            // Determinar label (PK, FK, UK o vacío)
            let label = '';
            if (data.primaryKey.includes(col.COLUMN_NAME)) {
                label = 'PK';
            } else if (data.foreignKeys.some(f => f.COLUMN_NAME === col.COLUMN_NAME)) {
                label = 'FK';
            } else if (data.uniqueKeys.includes(col.COLUMN_NAME)) {
                label = 'UK';
            }
            
            // CORRECCIÓN: Solo añadir label si existe
            const labelPart = label ? ` ${label}` : '';
            content += `    ${cleanType} ${col.COLUMN_NAME}${labelPart}\n`;
        });
        content += `  }\n`;
    }

    // Relaciones
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        data.foreignKeys.forEach(fk => {
            // Determinar si es 1:1 o 1:N
            const isOneToOne = data.uniqueKeys.includes(fk.COLUMN_NAME) || 
                               data.primaryKey.includes(fk.COLUMN_NAME);
            
            // Sintaxis Mermaid para relaciones:
            // ||--||  : uno a uno
            // }o--||  : muchos a uno
            const relation = isOneToOne ? '||--||' : '}o--||';
            
            content += `  "${tableName}" ${relation} "${fk.REFERENCED_TABLE_NAME}" : "${fk.COLUMN_NAME}"\n`;
        });
    }
    
    return content;
}

// ============================================================================
// 2. PLANTUML (CORREGIDO)
// ============================================================================
function generatePlantUML(schema) {
    let content = `@startuml\n`;
    content += `!theme plain\n`;
    content += `hide circle\n`;
    content += `skinparam linetype ortho\n`;
    content += `skinparam shadowing false\n\n`;

    // Entidades (CORRECCIÓN: Sintaxis correcta sin markdown)
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        content += `entity ${tableName} {\n`;
        data.columns.forEach(col => {
            const isPk = data.primaryKey.includes(col.COLUMN_NAME);
            const isFk = data.foreignKeys.some(f => f.COLUMN_NAME === col.COLUMN_NAME);
            
            // Marcadores PlantUML: * = PK, # = FK
            const marker = isPk ? '*' : (isFk ? '#' : ' ');
            
            content += `  ${marker}${col.COLUMN_NAME} : ${col.COLUMN_TYPE}\n`;
        });
        content += `}\n\n`;
    }

    // Relaciones
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        data.foreignKeys.forEach(fk => {
            const isOneToOne = data.uniqueKeys.includes(fk.COLUMN_NAME) || 
                               data.primaryKey.includes(fk.COLUMN_NAME);
            
            // Sintaxis PlantUML: ||..|| (1:1), }o..|| (N:1)
            const arrow = isOneToOne ? '||..||' : '}o..||';
            
            content += `${tableName} ${arrow} ${fk.REFERENCED_TABLE_NAME}\n`;
        });
    }
    
    content += `@enduml`;
    return content;
}

// ============================================================================
// 3. GRAPHVIZ DOT (CORREGIDO)
// ============================================================================
function generateDOT(schema) {
    let content = `digraph DB {\n`;
    content += `  node [shape=record, fontname="Arial", fontsize=10];\n`;
    content += `  rankdir=LR;\n`;
    content += `  edge [fontsize=8, color="#666666"];\n\n`;

    // Función auxiliar para escapar caracteres especiales en DOT
    const escapeDOT = (str) => {
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\|/g, '\\|')
            .replace(/</g, '\\<')
            .replace(/>/g, '\\>')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}');
    };

    // Nodos (tablas)
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        let label = `{${escapeDOT(tableName)}|`;
        
        const columnLabels = data.columns.map(col => {
            let prefix = '';
            if (data.primaryKey.includes(col.COLUMN_NAME)) {
                prefix = '🔑 ';
            } else if (data.foreignKeys.some(f => f.COLUMN_NAME === col.COLUMN_NAME)) {
                prefix = '🔗 ';
            }
            return escapeDOT(`${prefix}${col.COLUMN_NAME}`);
        });
        
        label += columnLabels.join('\\n') + '}';
        
        content += `  "${escapeDOT(tableName)}" [label="${label}"];\n`;
    }

    content += '\n';

    // Aristas (relaciones)
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        data.foreignKeys.forEach(fk => {
            const label = escapeDOT(fk.COLUMN_NAME);
            content += `  "${escapeDOT(tableName)}" -> "${escapeDOT(fk.REFERENCED_TABLE_NAME)}" [label="${label}"];\n`;
        });
    }
    
    content += `}\n`;
    return content;
}

// ============================================================================
// 4. GRAPHML (CORREGIDO)
// ============================================================================
function generateGraphML(schema) {
    let content = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    content += `<graphml xmlns="http://graphml.graphdrawing.org/xmlns"\n`;
    content += `         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
    content += `         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns\n`;
    content += `         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">\n\n`;
    
    // CORRECCIÓN: Definir keys antes de usarlas
    content += `  <!-- Definición de atributos -->\n`;
    content += `  <key id="label" for="node" attr.name="label" attr.type="string"/>\n`;
    content += `  <key id="edgeLabel" for="edge" attr.name="label" attr.type="string"/>\n\n`;
    
    content += `  <graph id="G" edgedefault="directed">\n`;
    
    // Función auxiliar para escapar XML
    const escapeXML = (str) => {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };
    
    // Nodos (tablas)
    let nodeId = 0;
    const nodeMap = {};

    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;
        
        nodeMap[tableName] = `n${nodeId}`;
        
        content += `    <node id="n${nodeId}">\n`;
        content += `      <data key="label">${escapeXML(tableName)}</data>\n`;
        content += `    </node>\n`;
        
        nodeId++;
    }

    content += '\n';

    // Aristas (relaciones)
    let edgeId = 0;
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        data.foreignKeys.forEach(fk => {
            const source = nodeMap[tableName];
            const target = nodeMap[fk.REFERENCED_TABLE_NAME];
            
            if (source && target) {
                content += `    <edge id="e${edgeId}" source="${source}" target="${target}">\n`;
                content += `      <data key="edgeLabel">${escapeXML(fk.COLUMN_NAME)}</data>\n`;
                content += `    </edge>\n`;
                edgeId++;
            }
        });
    }
    
    content += `  </graph>\n`;
    content += `</graphml>\n`;
    
    return content;
}

// ============================================================================
// 5. SQL DDL (CORREGIDO)
// ============================================================================
function generateSQL(schema) {
    let content = `-- Script DDL generado automáticamente\n`;
    content += `-- Fecha: ${new Date().toISOString().split('T')[0]}\n\n`;
    content += `SET FOREIGN_KEY_CHECKS=0;\n`;
    content += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
    content += `SET time_zone = "+00:00";\n\n`;

    // Función auxiliar para escapar valores SQL
    const escapeSQL = (str) => {
        if (str === null || str === undefined) return 'NULL';
        return String(str).replace(/'/g, "''");
    };

    // Crear tablas
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;

        content += `-- Tabla: ${tableName}\n`;
        content += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        content += `CREATE TABLE \`${tableName}\` (\n`;
        
        const lines = [];
        
        data.columns.forEach(col => {
            let line = `  \`${col.COLUMN_NAME}\` ${col.COLUMN_TYPE}`;
            
            if (col.IS_NULLABLE === 'NO') {
                line += ' NOT NULL';
            }
            
            // CORRECCIÓN: Escapar valores DEFAULT
            if (col.COLUMN_DEFAULT !== null && col.COLUMN_DEFAULT !== undefined) {
                const defaultVal = escapeSQL(col.COLUMN_DEFAULT);
                // Si el default es una función (CURRENT_TIMESTAMP), no usar comillas
                if (defaultVal.toUpperCase().includes('CURRENT_TIMESTAMP') || 
                    defaultVal === 'NULL') {
                    line += ` DEFAULT ${defaultVal}`;
                } else {
                    line += ` DEFAULT '${defaultVal}'`;
                }
            }
            
            if (col.EXTRA) {
                line += ` ${col.EXTRA}`;
            }
            
            // Agregar comentario si existe
            if (col.COLUMN_COMMENT) {
                line += ` COMMENT '${escapeSQL(col.COLUMN_COMMENT)}'`;
            }
            
            lines.push(line);
        });

        // Primary Key
        if (data.primaryKey.length > 0) {
            const pkCols = data.primaryKey.map(pk => `\`${pk}\``).join(', ');
            lines.push(`  PRIMARY KEY (${pkCols})`);
        }

        // Unique Keys
        data.uniqueKeys.forEach((uk, idx) => {
            if (!data.primaryKey.includes(uk)) {
                lines.push(`  UNIQUE KEY \`uk_${uk}_${idx}\` (\`${uk}\`)`);
            }
        });

        content += lines.join(',\n');
        content += `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
    }

    // Foreign Keys (al final para evitar problemas de orden)
    content += `-- Agregar Foreign Keys\n`;
    for (const [tableName, data] of Object.entries(schema)) {
        if (tableName === 'extra') continue;
        
        data.foreignKeys.forEach((fk, idx) => {
            content += `ALTER TABLE \`${tableName}\` \n`;
            content += `  ADD CONSTRAINT \`fk_${tableName}_${idx}\` \n`;
            content += `  FOREIGN KEY (\`${fk.COLUMN_NAME}\`) \n`;
            content += `  REFERENCES \`${fk.REFERENCED_TABLE_NAME}\` (\`${fk.REFERENCED_COLUMN_NAME}\`)`;
            
            if (fk.DELETE_RULE && fk.DELETE_RULE !== 'NO ACTION') {
                content += `\n  ON DELETE ${fk.DELETE_RULE}`;
            }
            if (fk.UPDATE_RULE && fk.UPDATE_RULE !== 'NO ACTION') {
                content += `\n  ON UPDATE ${fk.UPDATE_RULE}`;
            }
            
            content += `;\n\n`;
        });
    }

    content += `SET FOREIGN_KEY_CHECKS=1;\n`;
    return content;
}

// ============================================================================
// 6. JSON (SIN CAMBIOS - Ya estaba bien)
// ============================================================================
function generateJSON(schema) {
    // Crear una copia limpia sin funciones ni valores undefined
    const cleanSchema = JSON.parse(JSON.stringify(schema));
    return JSON.stringify(cleanSchema, null, 2);
}

// ============================================================================
// EXPORTAR FUNCIONES
// ============================================================================
module.exports = {
    generateMermaid,
    generatePlantUML,
    generateDOT,
    generateGraphML,
    generateSQL,
    generateJSON
};