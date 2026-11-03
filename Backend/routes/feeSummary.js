const express = require('express');
const supabase = require('../lib/supabase');
const { requireManager } = require('../middleware/auth');

const router = express.Router();

// Manager only: how many fees are due and how much they total
router.get('/fees/summary', requireManager, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('briefs')
      .select('commission_amount')
      .eq('fee_status', 'due');
    if (error) return res.status(500).json({ error: error.message });
    res.json({
      due_count: data.length,
      due_total: data.reduce((t, b) => t + Number(b.commission_amount || 0), 0)
    });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;