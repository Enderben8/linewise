// Prints ESLint errors (severity 2) one per line: file:line rule message.
const { execSync } = require('child_process');
const path = require('path');

let out;
try {
  out = execSync('npx eslint . --format json', {
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();
} catch (e) {
  out = e.stdout.toString();
}
for (const f of JSON.parse(out)) {
  for (const m of f.messages) {
    if (m.severity === 2) {
      const rel = path.relative(process.cwd(), f.filePath).split(path.sep).join('/');
      console.log(`${rel}:${m.line} ${m.ruleId} ${m.message.split('\n')[0]}`);
    }
  }
}
