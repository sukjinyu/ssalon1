import { json, listRankings, type Env } from '../_shared/save';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => json({ rankings: await listRankings(env.DB) });
