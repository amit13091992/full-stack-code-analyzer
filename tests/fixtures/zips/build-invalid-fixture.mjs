import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regenerates the deliberately-invalid ZIP fixture used by the E2E error-path test
// (upload something invalid -> error state, not a crash). Not run automatically; kept only
// so the fixture's provenance is documented and reproducible.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.join(__dirname, 'invalid.zip'), 'this is not a valid zip file at all');
console.log('Wrote invalid.zip');
