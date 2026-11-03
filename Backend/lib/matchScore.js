// How well a property fits the brief it was sourced for.
// STAFF ONLY. This is never sent to client accounts.
const WEIGHTS = { budget: 30, bedrooms: 10, bathrooms: 5, cars: 5, plot: 10, yield: 15, age: 5, area: 10 };
const FLAG_PENALTY = 5;
const EXCLUDED_AREA_PENALTY = 25;
const MAX_PENALTY = 40;
const CURRENT_YEAR = new Date().getFullYear();

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round1 = (n) => Math.round(n * 10) / 10;

function tokens(text) {
  return String(text || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 3);
}

function inArea(p, list) {
  const region = String(p.region || '').trim().toLowerCase();
  const haystack = `${region} ${String(p.address || '').toLowerCase()}`;
  return list.some((t) => haystack.includes(t) || (region.length >= 3 && t.includes(region)));
}

function scoreProperty(p, brief) {
  const parts = [];
  const missing = [];
  const add = (key, label, max, share, note) =>
    parts.push({ key, label, max, points: round1(max * share), note });
  const lack = (key, label, max, what) => {
    missing.push(what);
    parts.push({ key, label, max, points: 0, note: 'Not entered yet' });
  };

  // Budget
  const lo = num(brief.price_min);
  const hi = num(brief.price_max);
  if (lo !== null || hi !== null) {
    const from = num(p.price);
    if (from === null) {
      lack('budget', 'Budget', WEIGHTS.budget, 'price');
    } else {
      const to = num(p.price_max);
      const price = to !== null ? (from + to) / 2 : from;
      const below = lo !== null && lo > 0 && price < lo ? (lo - price) / lo : 0;
      const above = hi !== null && hi > 0 && price > hi ? (price - hi) / hi : 0;
      const off = Math.max(below, above);
      const share = off === 0 ? 1 : off <= 0.05 ? 0.6 : off <= 0.1 ? 0.3 : 0;
      add('budget', 'Budget', WEIGHTS.budget, share,
        off === 0 ? 'Inside the budget' : `${Math.round(off * 100)}% outside the budget`);
    }
  }

  // Bedrooms, bathrooms and car spaces: the brief's number is the minimum wanted
  [
    ['bedrooms', 'Bedrooms', WEIGHTS.bedrooms, num(brief.bedrooms), num(p.bedrooms), 'bedrooms'],
    ['bathrooms', 'Bathrooms', WEIGHTS.bathrooms, num(brief.bathrooms), num(p.bathrooms), 'bathrooms'],
    ['cars', 'Car spaces', WEIGHTS.cars, num(brief.car_spaces), num(p.car_parking), 'car spaces']
  ].forEach(([key, label, weight, wanted, actual, what]) => {
    if (wanted === null || wanted <= 0) return;
    if (actual === null) {
      lack(key, label, weight, what);
      return;
    }
    const share = actual >= wanted ? 1 : actual === wanted - 1 ? 0.5 : 0;
    add(key, label, weight, share, `${actual} (wanted ${wanted} or more)`);
  });

  // Plot size
  const minPlot = num(brief.min_plot_size);
  if (minPlot !== null && minPlot > 0) {
    const plot = num(p.plot_size);
    if (plot === null) {
      lack('plot', 'Plot size', WEIGHTS.plot, 'plot size');
    } else {
      const share = plot >= minPlot ? 1 : plot >= minPlot * 0.9 ? 0.5 : 0;
      add('plot', 'Plot size', WEIGHTS.plot, share, `${plot} m² (wanted ${minPlot} m² or more)`);
    }
  }

  // Yield
  const target = num(brief.min_yield);
  if (target !== null && target > 0) {
    const y = num(p.est_rental_yield);
    if (y === null) {
      lack('yield', 'Rental yield', WEIGHTS.yield, 'estimated rental yield');
    } else {
      const share = y >= target ? 1 : y >= target - 0.5 ? 0.5 : 0;
      add('yield', 'Rental yield', WEIGHTS.yield, share, `${y}% (wanted ${target}% or more)`);
    }
  }

  // Age (0 or empty in the brief means "no limit")
  const maxAge = num(brief.max_property_age);
  if (maxAge !== null && maxAge > 0) {
    const built = num(p.built_year);
    if (built === null) {
      lack('age', 'Property age', WEIGHTS.age, 'built year');
    } else {
      const age = CURRENT_YEAR - built;
      add('age', 'Property age', WEIGHTS.age, age <= maxAge ? 1 : 0, `${age} years old (wanted ${maxAge} or less)`);
    }
  }

  // Location
  const preferred = tokens(brief.preferred_areas);
  if (preferred.length) {
    const hit = inArea(p, preferred);
    add('area', 'Location', WEIGHTS.area, hit ? 1 : 0, hit ? 'In a preferred area' : 'Not in a preferred area');
  }

  // Red flags
  const flags = [];
  let penalty = 0;
  const excluded = tokens(brief.exclusions);
  if (excluded.length && inArea(p, excluded)) {
    flags.push('In an excluded area');
    penalty += EXCLUDED_AREA_PENALTY;
  }
  const more = [
    [p.bushfire_zone === 'detected', 'Bushfire zone'],
    [p.flood_zone === 'detected', 'Flood zone'],
    [p.heritage_zone === 'detected', 'Heritage zone'],
    [p.easements === 'detected', 'Easements'],
    [p.adjacent_main_road === true, 'Adjacent to a main road'],
    [p.noise_level === 'high', 'High noise'],
    [p.social_housing_nearby === true, 'Social housing nearby']
  ];
  more.forEach(([on, text]) => {
    if (on) {
      flags.push(text);
      penalty += FLAG_PENALTY;
    }
  });
  penalty = Math.min(penalty, MAX_PENALTY);

  const possible = parts.reduce((t, x) => t + x.max, 0);
  const earned = parts.reduce((t, x) => t + x.points, 0);
  if (possible === 0) {
    return { score: null, label: 'No criteria', parts, flags, missing, penalty };
  }

  const score = Math.max(0, Math.min(100, Math.round((earned / possible) * 100 - penalty)));
  const label = score >= 75 ? 'Strong match' : score >= 50 ? 'Fair match' : 'Weak match';
  return { score, label, parts, flags, missing, penalty };
}

// Short version for cards and lists
function matchSummary(m) {
  return { score: m.score, label: m.label, flags: m.flags.length };
}

module.exports = { scoreProperty, matchSummary };