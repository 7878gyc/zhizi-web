import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: '扣子编程 - AI 开发伙伴',
  description: '扣子编程，你的 AI 开发伙伴已就位',
};

export default function Home() {
  return (
    <div className="flex h-full items-center justify-center bg-background text-foreground transition-colors duration-300 dark:bg-background dark:text-foreground overflow-hidden min-h-screen">
      {/* 主容器 */}
      <main className="flex w-full h-full max-w-3xl flex-col items-center justify-center px-16 py-32 sm:items-center">
        <div className="flex flex-col items-center justify-between gap-4">
           <Image
            src="https://lf-coze-web-cdn.coze.cn/obj/eden-cn/lm-lgvj/ljhwZthlaukjlkulzlp/coze-coding/icon/coze-coding.gif"
            alt="扣子编程 Logo"
            width={156}
            height={130}
          />
          <div>
            <div className="flex flex-col items-center gap-2 text-center sm:items-center sm:text-center">
              <h1 className="max-w-xl text-base font-semibold leading-tight tracking-tight text-foreground dark:text-foreground">
                应用开发中
              </h1>
              <p className="max-w-2xl text-sm leading-8 text-muted-foreground dark:text-muted-foreground">
                请稍后，页面即将呈现
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
