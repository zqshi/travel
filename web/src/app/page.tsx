import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col -mt-16">
      {/* Hero — full viewport height, immersive */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-blue-50/60 to-white dark:from-gray-900 dark:via-blue-950/20 dark:to-gray-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        {/* Decorative shapes */}
        <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full bg-cyan-200/20 dark:bg-cyan-800/10 blur-3xl" />
        <div className="absolute bottom-32 right-[15%] w-96 h-96 rounded-full bg-blue-200/20 dark:bg-blue-800/10 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-5 text-center pt-24 pb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-border/40 text-xs font-medium text-foreground/70 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            首发目的地: 泰国 · 更多目的地即将开放
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-7 leading-[1.1]">
            AI帮你搞定
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-500 to-cyan-400 bg-clip-text text-transparent">出境自由行</span>
          </h1>

          <p className="text-lg sm:text-xl text-foreground/60 max-w-2xl mx-auto mb-12 leading-relaxed">
            告诉AI你的旅行想法，自动检索全网实时信息、生成结构化攻略、多平台比价一键预定
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/chat"
              className="bg-gradient-to-r from-primary to-blue-500 text-white px-9 py-4 rounded-full font-semibold text-lg hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              免费开始规划
            </Link>
            <Link
              href="#how-it-works"
              className="px-9 py-4 rounded-full font-medium text-lg text-foreground/70 hover:text-foreground border border-border/60 hover:border-border hover:bg-white/50 dark:hover:bg-white/5 transition-all"
            >
              了解更多
            </Link>
          </div>

          {/* Trust signals */}
          <div className="mt-20 flex items-center justify-center gap-10 text-foreground/40 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
              <span>实时检索</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
              <span>多平台比价</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
              <span>信息溯源</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-5 py-24">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary mb-2">HOW IT WORKS</p>
          <h2 className="text-3xl sm:text-4xl font-bold">三步搞定旅行规划</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <StepCard
            step={1}
            icon="💬"
            title="说出你的想法"
            description="自然语言描述需求：目的地、时间、预算、偏好。AI自动理解并规划"
            color="from-blue-500 to-blue-600"
          />
          <StepCard
            step={2}
            icon="🔍"
            title="AI全网检索"
            description="实时检索多平台最新信息，生成结构化攻略，每条推荐附溯源链接"
            color="from-violet-500 to-violet-600"
          />
          <StepCard
            step={3}
            icon="✈️"
            title="比价预定"
            description="Klook、KKday、Agoda等多平台比价，最优方案一键直达预定"
            color="from-cyan-500 to-teal-500"
          />
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border/40 bg-gradient-to-b from-card/30 to-background">
        <div className="max-w-6xl mx-auto px-5 py-24">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-primary mb-2">FEATURES</p>
            <h2 className="text-3xl sm:text-4xl font-bold">为什么选择 TravelAgent</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureCard icon="🌐" title="跨语言理解" description="泰语、日语等本地平台信息AI自动提取翻译" />
            <FeatureCard icon="💰" title="多平台比价" description="Klook/KKday/Agoda 多平台价格自动聚合对比" />
            <FeatureCard icon="⏱️" title="实时信息" description="基于最新检索结果生成攻略，标注来源时间" />
            <FeatureCard icon="🗂️" title="信息溯源" description="每条推荐附原始来源，站内抽屉预览不跳转" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-cyan-500/5" />
        <div className="relative max-w-3xl mx-auto px-5 py-28 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-5">准备好下一次旅行了吗？</h2>
          <p className="text-foreground/60 text-lg mb-10">输入你的想法，AI实时检索并生成完整攻略</p>
          <Link
            href="/chat"
            className="inline-flex bg-gradient-to-r from-primary to-blue-500 text-white px-9 py-4 rounded-full font-semibold text-lg hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
          >
            免费开始
          </Link>
        </div>
      </section>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  description,
  color,
}: {
  step: number;
  icon: string;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="relative p-8 rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 transition-all group">
      <div className={`inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br ${color} items-center justify-center text-2xl shadow-lg mb-6`}>
        {icon}
      </div>
      <div className="absolute top-6 right-6 text-[11px] font-mono font-bold text-foreground/15 group-hover:text-primary/30 transition-colors">
        0{step}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-foreground/60 leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm hover:border-primary/20 hover:shadow-md transition-all">
      <div className="text-2xl mb-4">{icon}</div>
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-foreground/55 leading-relaxed">{description}</p>
    </div>
  );
}
