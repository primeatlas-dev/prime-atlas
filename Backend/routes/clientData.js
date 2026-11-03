const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');
const { BUCKET } = require('../lib/media');

const router = express.Router();
const fail = (res, error) => res.status(500).json({ error: error.message });
const ids = (rows) => (rows || []).map((r) => r.id);

async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  for (let i = 0; i < list.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(list.slice(i, i + 100));
  }
}

// ---------- DOWNLOAD EVERYTHING WE HOLD ABOUT A CLIENT (manager only) ----------
router.get('/clients/:id/export', requireManager, async (req, res) => {
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { data: briefs } = await supabase.from('briefs').select('*').eq('client_id', client.id);
    const briefIds = ids(briefs);

    let properties = [];
    let clusters = [];
    if (briefIds.length) {
      properties = (await supabase.from('properties').select('*').in('brief_id', briefIds)).data || [];
      clusters =
        (await supabase.from('clusters').select('*, cluster_suburbs(*)').in('brief_id', briefIds)).data || [];
    }

    const propIds = ids(properties);
    let messages = [];
    let media = [];
    if (propIds.length) {
      messages =
        (
          await supabase
            .from('messages')
            .select('property_id, sender_role, body, attachment_type, created_at')
            .in('property_id', propIds)
            .order('created_at')
        ).data || [];
      media =
        (
          await supabase
            .from('property_media')
            .select('property_id, kind, file_name, content_type, created_at')
            .in('property_id', propIds)
        ).data || [];
    }

    let login = null;
    if (client.user_id) {
      const { data } = await supabase
        .from('users')
        .select('email, active, created_at')
        .eq('id', client.user_id)
        .maybeSingle();
      login = data;
    }

    res.json({
      exported_at: new Date().toISOString(),
      client,
      login,
      briefs,
      clusters,
      properties,
      property_media: media,
      messages
    });
  } catch (e) {
    fail(res, e);
  }
});

// ---------- DELETE A CLIENT AND ALL THEIR DATA FOR GOOD (manager only) ----------
router.delete('/clients/:id', requireManager, async (req, res) => {
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, user_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const typed = String((req.body && req.body.confirm_name) || '').trim().toLowerCase();
    if (!typed || typed !== String(client.name).trim().toLowerCase()) {
      return res.status(400).json({ error: "Type the client's full name exactly to confirm" });
    }

    const { data: briefs } = await supabase.from('briefs').select('id').eq('client_id', client.id);
    const briefIds = ids(briefs);

    let propIds = [];
    if (briefIds.length) {
      propIds = ids((await supabase.from('properties').select('id').in('brief_id', briefIds)).data);
    }

    if (propIds.length) {
      // Files first, so nothing is left behind in storage
      const media =
        (await supabase.from('property_media').select('storage_path').in('property_id', propIds)).data || [];
      const chat =
        (
          await supabase
            .from('messages')
            .select('attachment_path')
            .in('property_id', propIds)
            .not('attachment_path', 'is', null)
        ).data || [];
      await removeFiles([...media.map((m) => m.storage_path), ...chat.map((m) => m.attachment_path)]);

      // Deleting properties also removes their history, media records, chats and read markers
      const { error } = await supabase.from('properties').delete().in('id', propIds);
      if (error) return fail(res, error);
    }

    if (briefIds.length) {
      // Deleting briefs also removes their clusters and suburbs
      const { error } = await supabase.from('briefs').delete().in('id', briefIds);
      if (error) return fail(res, error);
    }

    const { error: clientError } = await supabase.from('clients').delete().eq('id', client.id);
    if (clientError) return fail(res, clientError);

    if (client.user_id) {
      const { error } = await supabase.from('users').delete().eq('id', client.user_id);
      if (error) return fail(res, error);
    }

    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;