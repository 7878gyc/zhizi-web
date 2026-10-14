/**
 * 为 ImageResponse（OG / Twitter 卡片）按需加载中文字体。
 *
 * ImageResponse 内置字体不含 CJK，若不加载字库中文会显示成方框。
 * 这里通过 Google Fonts 的 css2 接口（用旧 UA 换取 TTF）拉取 Noto Sans SC，
 * 模块级缓存；网络不可用时返回空数组，调用方需自行回退。
 */

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700;
  style: 'normal';
}

// 旧版 UA 才会拿到 ttf/otf 链接（现代 UA 只返回 woff2，satori 不支持 woff2）
const LEGACY_UA =
  'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.9.2.8) Gecko/20100722 Firefox/3.6.8';

let cache: LoadedFont[] | null = null;

export async function loadCjkFonts(): Promise<LoadedFont[]> {
  if (cache) return cache;
  try {
    const cssResp = await fetch(
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
      { headers: { 'User-Agent': LEGACY_UA }, cache: 'no-store' },
    );
    if (!cssResp.ok) {
      cache = [];
      return cache;
    }
    const css = await cssResp.text();
    const fonts: LoadedFont[] = [];
    for (const block of css.split('@font-face').slice(1)) {
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      const urlMatch = block.match(/url\((https:[^)]+)\)/);
      if (!urlMatch) continue;
      const weight = (weightMatch ? Number(weightMatch[1]) : 400) as LoadedFont['weight'];
      const fontResp = await fetch(urlMatch[1]);
      if (!fontResp.ok) continue;
      fonts.push({
        name: 'Noto Sans SC',
        data: await fontResp.arrayBuffer(),
        weight,
        style: 'normal',
      });
    }
    cache = fonts;
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}
