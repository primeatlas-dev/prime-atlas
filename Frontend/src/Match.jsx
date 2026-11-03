import React from 'react';

export function matchColor(score) {
  return score >= 75 ? 'bg-green-600' : score >= 50 ? 'bg-yellow-500' : 'bg-red-600';
}

// Small badge for cards. Staff only: the server never sends a match to client accounts.
export function MatchBadge({ match, floating }) {
  if (!match || match.score === null || match.score === undefined) return null;
  const badge = (
    <span
      className={`px-2 py-1 rounded text-xs font-semibold text-white shadow ${matchColor(match.score)}`}
      title={`${match.label}${match.flags ? `, ${match.flags} red flag${match.flags > 1 ? 's' : ''}` : ''}`}
    >
      {match.score}% match{match.flags > 0 ? ` · ⚠ ${match.flags}` : ''}
    </span>
  );
  return floating ? <div className="absolute bottom-2 right-2">{badge}</div> : badge;
}