import { MetadataRoute } from 'next';

const BASE = 'https://zhizi.110708.xyz';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy/human`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/privacy/legal`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
