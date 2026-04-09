import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /** Docker / self-hosted: emits `.next/standalone` for the web Dockerfile. */
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
