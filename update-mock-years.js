#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockDir = path.join(__dirname, 'src/lib/mock');

// Get all JSON files in the mock directory
const jsonFiles = fs.readdirSync(mockDir)
  .filter(file => file.endsWith('.json'));

console.log('Found JSON files:', jsonFiles);
console.log('Replacing all "2023" with "2025"...\n');

let totalReplacements = 0;

jsonFiles.forEach(file => {
  const filePath = path.join(mockDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Count occurrences before replacement
  const occurrences = (content.match(/2023/g) || []).length;

  // Replace all occurrences of 2023 with 2025
  const updatedContent = content.replace(/2023/g, '2025');

  // Write back to file
  fs.writeFileSync(filePath, updatedContent, 'utf8');

  console.log(`✓ ${file}: ${occurrences} replacements`);
  totalReplacements += occurrences;
});

console.log(`\n✓ Total replacements: ${totalReplacements}`);
console.log('All files updated successfully!');
