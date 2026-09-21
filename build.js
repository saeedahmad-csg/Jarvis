const fs = require('fs');

const apiKey = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';

const content = `// Auto-generated during build — do not edit manually
const CONFIG_API_KEY = '${apiKey}';
`;

fs.writeFileSync('config.js', content);
console.log('✓ config.js generated');
