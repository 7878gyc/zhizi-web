/**
 * 站点对外 URL。自部署时通过 NEXT_PUBLIC_SITE_URL 覆盖，
 * 避免 metadata / sitemap / robots 仍指向作者的线上实例。
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zhizi.110708.xyz'
).replace(/\/+$/, '');
