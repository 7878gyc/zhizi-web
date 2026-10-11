import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 构建时变量：next.config 在构建（或 dev 启动）时加载一次，这里取到的即为构建时间
  env: {
    BUILD_TIME: new Date().toISOString(),
  },
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),  // Uncomment and add 'import path from "path"' if needed
  /* config options here */
  allowedDevOrigins: ['*.monkeycode-ai.online'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
