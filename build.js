const fs = require('fs');
const path = require('path');

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

const configContent = `// Auto-generated during build — do not edit manually
const CONFIG_API_KEY = '${apiKey}';
`;

// Write config.js at root
fs.writeFileSync('config.js', configContent);

// Prepare dist/ for Vercel static deployment
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.writeFileSync(path.join(distDir, 'config.js'), configContent);

const filesToCopy = ['index.html', 'style.css', 'app.js'];
for (const file of filesToCopy) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(distDir, file));
  }
}

console.log('✓ Build complete: config.js generated and dist/ ready');
