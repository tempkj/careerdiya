import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local from the monorepo root (Next.js reads from the app dir by default,
// but in this Turborepo setup credentials live at the workspace root).
// override: true so values from the repo-root .env.local always win over
// any empty/unset shell variables (important for ANTHROPIC_API_KEY etc.)
loadDotenv({ path: resolve(__dirname, '../../.env.local'), override: true });

/** @type {import('next').NextConfig} */
const careerDiyaConfigPath = resolve(__dirname, 'public/assets/supabase-config.js');
const careerDiyaConfig = `// Generated at Next.js startup/build from server environment.\nwindow.CAREER_DIYA_SUPABASE = {\n  url: ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || '')},\n  anonKey: ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')}\n};\n`;
try {
  const fs = await import('node:fs/promises');
  await fs.mkdir(dirname(careerDiyaConfigPath), { recursive: true });
  await fs.writeFile(careerDiyaConfigPath, careerDiyaConfig, 'utf8');
} catch (error) {
  console.warn('Could not generate Career Diya Supabase config:', error);
}

const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Tell Next.js the correct monorepo root so it doesn't infer from a stray lockfile.
  outputFileTracingRoot: resolve(__dirname, '../..'),
};
export default nextConfig;
