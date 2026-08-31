/**
 * gpt-image-2 用の薄いプロキシ
 *
 * なぜ必要か：
 *   OpenAI API は CORS ヘッダーを返さないため、ブラウザから api.openai.com を
 *   直接呼ぶことはできません（file:// でもホスティングしたページでも同じ）。
 *   そのため、鍵を持つサーバーを1枚挟みます。
 *   Gemini は CORS を許可しているので、この関数は OpenAI を使うときだけ必要です。
 *
 * 置き場所：
 *   Vercel なら、この1ファイルを新しいプロジェクトの `api/openai-image.js` に置いて
 *   デプロイするだけで動きます（Next.js の pages/api でも同じ形です）。
 *
 * 環境変数：
 *   OPENAI_API_KEY       必須。OpenAI のキー。ブラウザには渡りません
 *   PROXY_TOKEN          任意。設定すると x-proxy-token が一致する呼び出しだけ通します。
 *                        URLが漏れただけで課金され続けるのを防げるので、設定を強く推奨します
 *   OPENAI_IMAGE_MODEL   任意。既定 gpt-image-2
 *   ALLOW_ORIGIN         任意。既定 *（file:// から使う場合は * のままにしてください）
 *
 * 注意：
 *   gpt-image-2 のリクエスト仕様は、実際のキーで一度疎通確認してください。
 *   形式が変わっていた場合も、直すのはこのファイルの callOpenAI() だけで済みます。
 */

const OPENAI_BASE = 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

// アスペクト比 → OpenAI の size 指定
const SIZES = {
  '1:1': '1024x1024',
  '4:3': '1536x1024',
  '3:2': '1536x1024',
  '16:9': '1536x1024',
  '3:4': '1024x1536',
  '2:3': '1024x1536',
};

// 参照画像があれば edits、なければ generations を使う。
// 絵本では毎ページ「キャラクター設定画」を参照させるので、ほぼ edits 側を通る。
async function callOpenAI({ apiKey, prompt, size, images }) {
  if (images.length > 0) {
    const form = new FormData();
    form.append('model', MODEL);
    form.append('prompt', prompt);
    form.append('size', size);
    images.forEach((img, i) => {
      const bytes = Buffer.from(img.data, 'base64');
      const type = img.mimeType || 'image/png';
      const ext = type.includes('jpeg') ? 'jpg' : 'png';
      form.append('image[]', new Blob([bytes], { type }), `reference-${i}.${ext}`);
    });
    return fetch(`${OPENAI_BASE}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  }

  return fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, prompt, size, n: 1 }),
  });
}

// b64_json で返る場合と url で返る場合の両方に備える
async function toBase64(item) {
  if (item?.b64_json) return { mimeType: 'image/png', data: item.b64_json };
  if (item?.url) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`画像の取得に失敗しました（HTTP ${r.status}）`);
    const buf = Buffer.from(await r.arrayBuffer());
    return { mimeType: r.headers.get('content-type') || 'image/png', data: buf.toString('base64') };
  }
  throw new Error('画像データが含まれていませんでした');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-proxy-token');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST のみ受け付けます' });

  const expected = process.env.PROXY_TOKEN;
  if (expected && req.headers['x-proxy-token'] !== expected) {
    return res.status(401).json({ error: '合言葉が一致しません' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY が設定されていません' });

  const { prompt, aspectRatio = '4:3', images = [] } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt がありません' });

  try {
    const upstream = await callOpenAI({
      apiKey,
      prompt,
      size: SIZES[aspectRatio] || SIZES['4:3'],
      images: Array.isArray(images) ? images : [],
    });

    const body = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: body?.error?.message || `OpenAI が HTTP ${upstream.status} を返しました`,
      });
    }

    return res.status(200).json(await toBase64(body?.data?.[0]));
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

// 参照画像をbase64で受け取るため、既定の1MB制限では足りない
export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};
