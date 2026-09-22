const fs = require('fs');

let apiKey = process.env.GEMINI_API_KEY;

// Check .env if available
if (!apiKey && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/GEMINI_API_KEY\s*=\s*['"]?([^'"\r\n]+)['"]?/);
  if (match) apiKey = match[1].trim();
}

// Preserve existing valid key in config.js if present
if (!apiKey && fs.existsSync('config.js')) {
  const existing = fs.readFileSync('config.js', 'utf8');
  const match = existing.match(/CONFIG_API_KEY\s*=\s*['"]([^'"]+)['"]/);
  if (match && match[1] && match[1] !== 'YOUR_GEMINI_API_KEY_HERE') {
    apiKey = match[1].trim();
  }
}

apiKey = apiKey || 'YOUR_GEMINI_API_KEY_HERE';

const content = `// Auto-generated during build — do not edit manually
const CONFIG_API_KEY = '${apiKey}';
`;

fs.writeFileSync('config.js', content);
console.log('✓ config.js generated');
