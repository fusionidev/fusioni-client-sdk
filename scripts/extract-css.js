import { readFileSync, writeFileSync } from 'fs';
import postcss from 'postcss';
import postcssRemIsolation from './postcss-rem-isolation.js';

// Legacy consumers may still import dist/index.css when using individual SDK
// components outside ShadowDomRoot. Apply the same rem isolation transform.
const css = readFileSync('src/styles/index.css', 'utf8');
const result = await postcss([postcssRemIsolation()]).process(css, { from: undefined });
writeFileSync('dist/index.css', result.css);
console.log('✅ dist/index.css written for legacy consumers');
