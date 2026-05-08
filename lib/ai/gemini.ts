import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateCardFromImage(imageUrl: string) {
  // 憲法 I 条: Gemini 2.5 Flash を使用（2.0 Flash 禁止）
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error('Failed to fetch image for analysis');

  const imageBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const mimeType = (imageResponse.headers.get('content-type') ?? 'image/jpeg') as string;

  const result = await model.generateContent([
    { inlineData: { data: base64, mimeType } },
    `この画像はGeoGuessrの日本のシーンです。
地理的特徴を特定して、学習カード用の日本語メモを作成してください。

以下の点に注目してください：
- 都道府県・地方（判定できる場合）
- 目立つ視覚的特徴（看板の文字・電柱・道路標識・建物の特徴・植生など）
- GeoGuessrでの識別に役立つ特徴

必ず以下のJSON形式のみで回答してください（他のテキスト不要）:
{"notes":"特徴の説明（2〜4文）","suggestedTags":["タグ1","タグ2","タグ3"]}`,
  ]);

  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid Gemini response format');

  return JSON.parse(jsonMatch[0]) as { notes: string; suggestedTags: string[] };
}
