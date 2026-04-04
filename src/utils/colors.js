// Deterministic, consistent color per sender — blue-based professional palette
const PALETTE = [
  { bg: 'rgba(96,165,250,0.14)',  border: 'rgba(96,165,250,0.35)',  name: '#60a5fa' }, // blue
  { bg: 'rgba(167,139,250,0.14)', border: 'rgba(167,139,250,0.35)', name: '#a78bfa' }, // violet
  { bg: 'rgba(52,211,153,0.14)',  border: 'rgba(52,211,153,0.35)',  name: '#34d399' }, // emerald
  { bg: 'rgba(251,191,36,0.14)',  border: 'rgba(251,191,36,0.35)',  name: '#fbbf24' }, // amber
  { bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.35)', name: '#f87171' }, // red
  { bg: 'rgba(45,212,191,0.14)',  border: 'rgba(45,212,191,0.35)',  name: '#2dd4bf' }, // teal
  { bg: 'rgba(196,181,253,0.14)', border: 'rgba(196,181,253,0.35)', name: '#c4b5fd' }, // purple
  { bg: 'rgba(125,211,252,0.14)', border: 'rgba(125,211,252,0.35)', name: '#7dd3fc' }, // sky
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const cache = new Map();

export function getColorForSender(sender) {
  if (cache.has(sender)) return cache.get(sender);
  const color = PALETTE[hash(sender) % PALETTE.length];
  cache.set(sender, color);
  return color;
}
