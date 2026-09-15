import { json, normalizePlayerName, resetSave, type Env } from '../../_shared/save';

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const player = normalizePlayerName(params.player);
  await resetSave(env.DB, player);
  return json({ ok: true, player });
};
