import { MetadataRoute } from 'next';

const BASE = 'https://zhizi.110708.xyz';

// 构建时间由 next.config.ts 的 env.BUILD_TIME 在构建时注入（回退到启动时刻）
const BUILD_TIME = new Date(process.env.BUILD_TIME ?? Date.now());

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified: BUILD_TIME, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/about`, lastModified: BUILD_TIME, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy/human`, lastModified: BUILD_TIME, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/privacy/legal`, lastModified: BUILD_TIME, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
