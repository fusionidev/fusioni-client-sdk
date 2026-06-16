import { readFileSync, writeFileSync } from 'fs';

// Legacy consumers may still import dist/index.css when using individual SDK
// components outside ShadowDomRoot. The main ChatWidget injects styles into its
// shadow root automatically.
writeFileSync('dist/index.css', readFileSync('src/styles/index.css', 'utf8'));
console.log('✅ dist/index.css written for legacy consumers');
