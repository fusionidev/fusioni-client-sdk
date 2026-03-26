import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the logo image file
const logoPath = path.join(__dirname, '../src/assets/images/Fusioni_Logo@120.png');
const outputPath = path.join(__dirname, '../src/assets/logo-base64.ts');

try {
  // Read the image file
  const imageBuffer = fs.readFileSync(logoPath);
  
  // Convert to base64
  const base64String = imageBuffer.toString('base64');
  
  // Create the TypeScript file with the base64 data
  const tsContent = `// Auto-generated file - do not edit manually
// This file is generated during the build process from Fusioni_Logo@120.png

export const FUSIONI_LOGO_BASE64 = 'data:image/png;base64,${base64String}';
`;

  // Write the TypeScript file
  fs.writeFileSync(outputPath, tsContent);
  
  console.log('✅ Logo converted to base64 and saved to src/assets/logo-base64.ts');
  console.log(`📏 Base64 string length: ${base64String.length} characters`);
  
} catch (error) {
  console.error('❌ Error converting logo to base64:', error.message);
  process.exit(1);
}
