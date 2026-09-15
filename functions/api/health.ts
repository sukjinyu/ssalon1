import { json } from '../_shared/save';

export const onRequestGet: PagesFunction = async () => json({ ok: true, database: 'cloudflare-d1' });
