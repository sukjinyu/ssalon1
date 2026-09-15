import { json, listPlayers, type Env } from '../_shared/save';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => json({ players: await listPlayers(env.DB) });
