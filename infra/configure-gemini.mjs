// Run from the repository root: node infra/configure-gemini.mjs
// Credentials remain in ignored .env.local and the Lambda server environment.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';

const local = dotenv.parse(fs.readFileSync('.env.local'));
const key = process.env.GEMINI_API_KEY || local.GEMINI_API_KEY;
if (!key || key === 'MY_GEMINI_API_KEY') throw new Error('Set GEMINI_API_KEY in .env.local first.');
const functionName = process.env.AIREXPO_LAMBDA_FUNCTION || 'AirExpo';
const args = ['--region', process.env.AWS_REGION || 'us-east-1', '--cli-connect-timeout', '10', '--cli-read-timeout', '20'];
const run = argv => execFileSync('aws', [...argv, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let temporaryDirectory;
try {
  const config = JSON.parse(run(['lambda', 'get-function-configuration', '--function-name', functionName]));
  const Variables = { ...config.Environment?.Variables, AI_PROVIDER: 'gemini', GEMINI_API_KEY: key };
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'airexpo-gemini-'));
  const environmentPath = path.join(temporaryDirectory, 'environment.json');
  fs.writeFileSync(environmentPath, JSON.stringify({ Variables }), { mode: 0o600 });
  run(['lambda', 'update-function-configuration', '--function-name', functionName, '--revision-id', config.RevisionId, '--environment', `file://${environmentPath}`]);
  run(['lambda', 'wait', 'function-updated', '--function-name', functionName]);
  console.log('Gemini server key updated. Existing settings and Google billing are unchanged.');
} catch {
  console.error('Could not update the Gemini server key. Check AWS access, region and function name.');
  process.exitCode = 1;
} finally {
  if (temporaryDirectory) {
    fs.unlinkSync(path.join(temporaryDirectory, 'environment.json'));
    fs.rmdirSync(temporaryDirectory);
  }
}
