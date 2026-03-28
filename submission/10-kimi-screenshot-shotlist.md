# MatchBuzz 截图选用清单

以下截图已导出，可直接作为 Kimi 生成 PPT 的视觉参考图。

## 推荐主图顺序

1. 首页英文版
   文件: `submission/screenshots/01-home-en.png`
   用途: 封面页、产品总览页、视觉基调参考

2. 赛程页
   文件: `submission/screenshots/02-matches-en.png`
   用途: 真实赛事数据、工作流入口、产品能力页

3. 合作变现页
   文件: `submission/screenshots/04-partners-en.png`
   用途: 商业模式、广告赞助、票务与品牌合作页

4. 注册与会员页
   文件: `submission/screenshots/05-auth-en.png`
   用途: 会员体系、积分裂变、三层推荐、真实后端能力页

5. 观赛活动页
   文件: `submission/screenshots/05-watch-parties-en.png`
   用途: 线下转化、活动预订、票务导流页

6. 增长页
   文件: `submission/screenshots/06-growth-en.png`
   用途: SEO、增长飞轮、渠道运营、出海增长页

7. 首页中文版
   文件: `submission/screenshots/08-home-zh.png`
   用途: 中文答辩版封面、双语切换能力展示

## 不建议放进 PPT 的图

- `submission/screenshots/02-studio-en.png`
  原因: 白屏，不可用

- `submission/screenshots/02-campaign-en.png`
  原因: 页面缺少真实 campaign id，信息不完整

## 给 Kimi 的风格约束

可直接复制下面这段作为补充提示词：

```text
PPT 视觉请严格对齐 MatchBuzz 网站风格：
1. 主色调是明亮绿茵场绿色渐变，不要深黑或科技蓝。
2. 卡片使用深绿色半透明大圆角模块，按钮使用荧光黄绿色高亮。
3. 字体气质偏国际体育产品，厚重、直接、可读，不要花哨装饰。
4. 页面像 SofaScore / FotMob / ScorePlay 一类国际足球产品，不要像传统创业路演模板。
5. 每页尽量保留网站里的大标题 + 深色信息卡 + 亮色 CTA 的结构。
6. 封面、产品页、商业化页、增长页都优先贴近网站截图的布局比例。
7. 中文版页面保持中文内容，但视觉结构仍按英文站一致处理。
```

## 建议给 Kimi 的页面映射

- 封面: `01-home-en.png`
- 痛点与机会: `02-matches-en.png`
- 产品闭环: `01-home-en.png` + `05-watch-parties-en.png`
- 会员与增长: `05-auth-en.png` + `06-growth-en.png`
- 商业模式: `04-partners-en.png`
- 双语与答辩版收尾: `08-home-zh.png`
