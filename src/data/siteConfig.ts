// 站点配置
export const siteConfig = {
  // 基本信息
  title: '浮生百记',
  subtitle: 'Jin 的个人博客',
  description: '记录生活、技术、旅行和投资',
  url: 'https://krya.com',
  author: 'Jin',
  language: 'zh-Hans-CN',
  timezone: 'Asia/Shanghai',

  // 社交链接
  social: {
    twitter: 'https://x.com/uniifi',
    github: 'https://github.com/ezzty',
    rss: '/rss.xml',
  },

  // 导航菜单
  navigation: {
    main: [
      { label: '首页', href: '/' },
      { label: '归档', href: '/archives' },
      { label: '关于', href: '/about' },
    ],
  },

  // SEO 配置
  seo: {
    keywords: ['博客', '技术', '旅行', '投资', '生活'],
    ogImage: '/og-image.png',
    twitterCard: 'summary_large_image',
  },

  // 分页配置
  pagination: {
    pageSize: 10,
  },
};
