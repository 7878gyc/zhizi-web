import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

const BASE = SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/_next/', '/static/'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
