import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files to process and their field mappings
const filesToProcess = [
  {
    file: 'src/lib/mock/asuntos.json',
    fields: ['id', 'cliente_id']
  },
  {
    file: 'src/lib/mock/facturacion.json',
    fields: ['cliente_id', 'asunto_id']
  },
  {
    file: 'src/lib/mock/time-entries.json',
    fields: ['cliente_id', 'asunto_id']
  },
  {
    file: 'src/lib/mock/clientes.json',
    fields: ['id']
  }
];

function convertFieldsToNumbers(data, fields) {
  if (Array.isArray(data)) {
    return data.map(item => convertFieldsToNumbers(item, fields));
  } else if (data && typeof data === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(data)) {
      if (fields.includes(key) && typeof value === 'string') {
        // Convert string to number, handling leading zeros
        const numValue = parseInt(value, 10);
        converted[key] = isNaN(numValue) ? value : numValue;
      } else if (Array.isArray(value) || (value && typeof value === 'object')) {
        converted[key] = convertFieldsToNumbers(value, fields);
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }
  return data;
}

function processFile(filePath, fields) {
  const fullPath = path.join(__dirname, filePath);

  console.log(`Processing ${filePath}...`);

  try {
    // Read the file
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(fileContent);

    // Convert fields
    const convertedData = convertFieldsToNumbers(data, fields);

    // Write back to file
    fs.writeFileSync(fullPath, JSON.stringify(convertedData, null, 2), 'utf8');

    console.log(`✓ Successfully converted ${fields.join(', ')} in ${filePath}`);
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    process.exit(1);
  }
}

// Process all files
console.log('Starting conversion of id and cliente_id from strings to numbers...\n');

filesToProcess.forEach(({ file, fields }) => {
  processFile(file, fields);
});

console.log('\n✓ All files processed successfully!');
