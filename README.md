# mirai-innovation-website
MirAI Innovation &amp; Co. 公式Webサイト

## 構成

ビルド不要の静的サイトです。`index.html` をブラウザで開けばそのまま確認できます。

```
index.html                      自己紹介ページ
assets/style.css                スタイル
apps/dream-job-storybook/       MirAI塾 夢の職業絵本メーカー
```

`index.html` 内の `class="tbd"` が付いた箇所はプロフィール未確定のプレースホルダーです。
内容を差し込んだら、`<span class="tbd">…</span>` のラッパーごと本文に置き換えてください。

## apps/dream-job-storybook

MirAI塾で使う「夢の職業絵本メーカー」です。夢職業診断から絵本づくり、
ビジネスモデルキャンバスへの展開までを、コピー＆ペーストなしで完結させます。
詳細は [apps/dream-job-storybook/README.md](apps/dream-job-storybook/README.md) を参照してください。
