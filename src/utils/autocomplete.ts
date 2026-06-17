export interface SchemaColumn {
  name: string;
  data_type: string;
  primary_key?: boolean;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

export interface SchemaMetadata {
  tables: SchemaTable[];
}

/**
 * Generate semantic autocomplete suggestions based on the database schema
 * and the user's current partial text input.
 */
export function getSuggestions(input: string, schema: SchemaMetadata | null): string[] {
  if (!schema || !schema.tables || schema.tables.length === 0) {
    return [];
  }

  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const lowerInput = trimmed.toLowerCase();
  const suggestions: string[] = [];

  const tables = schema.tables;

  for (const table of tables) {
    const tableName = table.name;
    const columns = table.columns || [];

    const numericCols = columns.filter(c => {
      const type = (c.data_type || '').toUpperCase();
      return type.includes('INT') || type.includes('DECIMAL') || type.includes('REAL') || 
             type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('NUMERIC') || 
             type.includes('MONEY');
    }).map(c => c.name);

    const dateCols = columns.filter(c => {
      const type = (c.data_type || '').toUpperCase();
      return type.includes('DATE') || type.includes('TIME') || type.includes('TIMESTAMP');
    }).map(c => c.name);

    const categoricCols = columns.filter(c => {
      const name = c.name.toLowerCase();
      return name.includes('status') || name.includes('category') || name.includes('country') || 
             name.includes('state') || name.includes('gender') || name.includes('type') || 
             name.includes('role');
    }).map(c => c.name);

    // 1. Check if the user is typing the table name or a part of it
    if (lowerInput.includes(tableName.toLowerCase()) || tableName.toLowerCase().includes(lowerInput)) {
      suggestions.push(`How many ${tableName} are there?`);
      suggestions.push(`Show all records from ${tableName}`);

      // Add numeric suggestions
      for (const col of numericCols) {
        suggestions.push(`List the top 5 ${tableName} by ${col}`);
        suggestions.push(`What is the average ${col} of ${tableName}?`);
        if (categoricCols.length > 0) {
          suggestions.push(`Show total ${col} in ${tableName} grouped by ${categoricCols[0]}`);
        }
      }

      // Add date suggestions
      for (const col of dateCols) {
        suggestions.push(`Show the latest 10 ${tableName} by ${col}`);
        suggestions.push(`Show all ${tableName} in the last 30 days`);
      }
    }
  }

  // 2. Generic query verb starting matches
  if (lowerInput.startsWith('how') || lowerInput.startsWith('count')) {
    for (const table of tables) {
      suggestions.push(`How many ${table.name} are there?`);
      suggestions.push(`Count the number of ${table.name}`);
    }
  } else if (lowerInput.startsWith('avg') || lowerInput.startsWith('average')) {
    for (const table of tables) {
      const numCols = (table.columns || []).filter(c => {
        const type = (c.data_type || '').toUpperCase();
        return type.includes('INT') || type.includes('DECIMAL') || type.includes('REAL') || 
               type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('NUMERIC');
      });
      for (const col of numCols) {
        suggestions.push(`What is the average ${col.name} of ${table.name}?`);
      }
    }
  } else if (lowerInput.startsWith('top') || lowerInput.startsWith('highest')) {
    for (const table of tables) {
      const numCols = (table.columns || []).filter(c => {
        const type = (c.data_type || '').toUpperCase();
        return type.includes('INT') || type.includes('DECIMAL') || type.includes('REAL') || 
               type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('NUMERIC');
      });
      for (const col of numCols) {
        suggestions.push(`Show the top 5 ${table.name} by ${col.name}`);
      }
    }
  } else if (lowerInput.startsWith('list') || lowerInput.startsWith('show')) {
    for (const table of tables) {
      suggestions.push(`Show all records from ${table.name}`);
    }
  }

  // Filter by string containment, prevent exact matches, and cap at 5 suggestions
  const result = Array.from(new Set(suggestions))
    .filter(s => s.toLowerCase().includes(lowerInput) && s.toLowerCase() !== lowerInput)
    .slice(0, 5);

  return result;
}
