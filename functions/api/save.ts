import { json, normalizePlayerName, readSave, validSave, writeSave, type Env } from '../_shared/save';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const player = normalizePlayerName(url.searchParams.get('player'));
  return json({ player, ...(await readSave(env.DB, player)) });
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const body = await request.json().catch(() => null);
  const player = normalizePlayerName(body?.player);
  const save = { profile: body?.profile, game: body?.game };
  if (!validSave(save)) return json({ error: '저장 데이터 형식이 올바르지 않습니다.' }, 400);
  await writeSave(env.DB, player, save);
  return json({ ok: true, player });
};
