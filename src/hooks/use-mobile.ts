import * as React from "react"

export const MOBILE_BREAKPOINT = 768

/** 纯函数版断点判断，便于测试；横屏矮屏也使用移动布局。 */
export function isMobileViewport(width: number, height: number): boolean {
  return width < MOBILE_BREAKPOINT || (width <= 1023 && height <= 500)
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // 手机横屏时宽度可能超过 768（如 844x390），但高度很矮，
    // 继续用桌面布局会把棋盘挤到首屏之外，因此把矮屏也归为移动布局。
    const mql = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px), (max-height: 500px) and (max-width: 1023px)`
    )
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
