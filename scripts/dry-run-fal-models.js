import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VideoGenerationService } from '../src/services/videoGenerationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function findSampleImage(inputDir) {
  const candidates = fs.readdirSync(inputDir)
    .filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i))
    .sort();
  if (candidates.length === 0) {
    throw new Error(`No sample images found in ${inputDir}`);
  }
  return path.join(inputDir, candidates[0]);
}

async function run() {
  const inputDir = path.resolve(__dirname, '..', 'input');
  const testsRoot = path.resolve(__dirname, '..', 'output', 'tests');

  await ensureDir(testsRoot);

  const imagePath = findSampleImage(inputDir);
  const originalFileName = path.basename(imagePath);

  const models = [
    { id: 'wan-2.2-turbo', name: 'WAN 2.2 Turbo', dir: path.join(testsRoot, 'wan-22') },
    { id: 'wan-2.5-preview', name: 'WAN 2.5 Preview', dir: path.join(testsRoot, 'wan-25') },
    { id: 'kling-v2.5-turbo', name: 'Kling 2.5 Turbo Pro', dir: path.join(testsRoot, 'kling-25') },
  ];

  const vgs = new VideoGenerationService();

  console.log('🧪 Dry-running FAL models (placeholders only)');
  console.log(`📸 Using sample image: ${imagePath}`);

  for (const m of models) {
    try {
      await ensureDir(m.dir);
      vgs.setModel(m.id);

      const prompt = `Dry run verification for ${m.name}. No external API calls.`;

      const resultPath = await vgs.generateVideo(
        prompt,
        imagePath,
        originalFileName,
        { dryRun: true, outputDir: m.dir }
      );

      const notePath = path.join(m.dir, 'README.txt');
      const note = `Model: ${m.name}\nMode: Dry Run (placeholder)\nSource Image: ${originalFileName}\nOutput: ${resultPath}\nTimestamp: ${new Date().toISOString()}\n`;
      fs.writeFileSync(notePath, note);

      console.log(`✅ ${m.name} placeholder written to: ${m.dir}`);
    } catch (err) {
      console.error(`❌ ${m.name} dry run failed:`, err.message);
    }
  }

  console.log(`\n📁 Results placed under: ${testsRoot}`);
}

run().catch(err => {
  console.error('Dry run script failed:', err);
  process.exit(1);
});

