// How clusters are ranked. All the numbers live here, so they are easy to change.
const POINTS = { suitability: 35, budget: 20, yield: 15, sold: 10, onMarket: 10, overlay: 10 };
const OVERLAY_PENALTY = 20;
const SUITABILITY_SHARE = { high: 1, medium: 0.5, low: 0 };
const FULL_MARKS_AT = 10; // 10 or more properties earns full marks
const BUDGET_TOLERANCE = 0.1; // within 10% of the budget earns half marks
const YIELD_TOLERANCE = 0.5; // within 0.5 points of the target yield earns half marks

const round1 = (n) => Math.round(n * 10) / 10;
const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function scoreSuburb(s, brief) {
  const missing = [];

  // Suitability
  const suitability = POINTS.suitability * (SUITABILITY_SHARE[s.suitability] ?? 0.5);

  // Budget fit: median price against the brief's price range
  const price = toNum(s.median_price);
  const lo = toNum(brief.price_min);
  const hi = toNum(brief.price_max);
  let budget = 0;
  if (lo === null && hi === null) {
    budget = POINTS.budget / 2; // the brief has no budget to compare with
  } else if (price === null) {
    missing.push('median price');
  } else {
    const below = lo !== null && lo > 0 && price < lo ? (lo - price) / lo : 0;
    const above = hi !== null && hi > 0 && price > hi ? (price - hi) / hi : 0;
    const off = Math.max(below, above);
    budget = off === 0 ? POINTS.budget : off <= BUDGET_TOLERANCE ? POINTS.budget / 2 : 0;
  }

  // Yield against the brief's minimum
  const medianYield = toNum(s.median_yield);
  const target = toNum(brief.min_yield);
  let yieldPoints = 0;
  if (target === null) {
    yieldPoints = POINTS.yield / 2; // the brief has no target to compare with
  } else if (medianYield === null) {
    missing.push('median yield');
  } else if (medianYield >= target) {
    yieldPoints = POINTS.yield;
  } else if (medianYield >= target - YIELD_TOLERANCE) {
    yieldPoints = POINTS.yield / 2;
  }

  // Market activity
  const share = (v) => Math.min(Math.max(v, 0), FULL_MARKS_AT) / FULL_MARKS_AT;
  const sold = toNum(s.sold_last_3m);
  const onMarket = toNum(s.on_market_count);
  let soldPoints = 0;
  if (sold === null) missing.push('sold in last 3 months');
  else soldPoints = POINTS.sold * share(sold);
  let marketPoints = 0;
  if (onMarket === null) missing.push('on market now');
  else marketPoints = POINTS.onMarket * share(onMarket);

  // Overlay
  let overlay = 0;
  if (s.overlay_over_75 === true) overlay = -OVERLAY_PENALTY;
  else if (s.overlay_over_75 === false) overlay = POINTS.overlay;
  else missing.push('overlay');

  const raw = suitability + budget + yieldPoints + soldPoints + marketPoints + overlay;
  const total = Math.min(100, Math.max(0, raw));

  return {
    total,
    score: Math.round(total),
    missing,
    breakdown: {
      suitability: round1(suitability),
      budget: round1(budget),
      yield: round1(yieldPoints),
      sold: round1(soldPoints),
      on_market: round1(marketPoints),
      overlay: round1(overlay)
    }
  };
}

// Adds a score to every suburb and a rank to every cluster (1 = source first)
function rankClusters(clusters, brief) {
  const scored = clusters.map((c) => {
    const suburbs = c.cluster_suburbs
      .map((s) => ({ ...s, ...scoreSuburb(s, brief) }))
      .sort((a, b) => b.total - a.total || a.suburb.localeCompare(b.suburb));

    const average = suburbs.length ? suburbs.reduce((t, s) => t + s.total, 0) / suburbs.length : 0;
    const highs = suburbs.filter((s) => s.suitability === 'high').length;
    const listings = suburbs.reduce((t, s) => t + (Number(s.on_market_count) || 0), 0);

    return {
      ...c,
      cluster_suburbs: suburbs.map(({ total, ...rest }) => rest),
      score: Math.round(average),
      missing_count: suburbs.filter((s) => s.missing.length > 0).length,
      _average: average,
      _highs: highs,
      _listings: listings
    };
  });

  scored.sort(
    (a, b) =>
      b._average - a._average ||
      b._highs - a._highs ||
      b._listings - a._listings ||
      (a.name || '').localeCompare(b.name || '')
  );

  return scored.map(({ _average, _highs, _listings, ...c }, i) => ({ ...c, rank: i + 1 }));
}

module.exports = { rankClusters };