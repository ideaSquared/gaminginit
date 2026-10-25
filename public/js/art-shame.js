import { cup, METAL, svg } from './art-season.js';

// The hall of shame's illustrations. All fixed inline SVG written here, like the season roundup's (art-season.js): nothing
// the bot sends is ever put in the markup, and the text beside each picture is set with textContent elsewhere.

// A banner scene: a stage in the dark with spotlights on three plinths: the cone of shame, a cracked trophy and a door
// left open. Cropped to fit any width.
export const banner = () => {
  const sparks = Array.from({ length: 24 }, (_, i) => {
    const x = (i * 197 + 60) % 1200;
    const y = ((i * 67 + 14) % 120) + 8;
    return `<circle cx="${x}" cy="${y}" r="${1 + (i % 3) * 0.7}" fill="${['#fab219', '#f87171', '#fff'][i % 3]}" opacity="${0.25 + (i % 4) * 0.12}"/>`;
  }).join('');
  const beam = (x) => `<path d="M${x - 14} 0h28l46 168h-120z" fill="url(#hb-beam)"/>`;
  const plinth = (x, w, h) => `<rect x="${x - w / 2}" y="${178 - h}" width="${w}" height="${h}" rx="3" fill="#2a1822"/><rect x="${x - w / 2}" y="${178 - h}" width="${w}" height="6" rx="3" fill="#4a2b3a"/>`;
  return svg(
    '0 0 1200 200',
    `<defs><linearGradient id="hb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14070f"/><stop offset=".65" stop-color="#4a1020"/><stop offset="1" stop-color="#8a1c1c"/></linearGradient><linearGradient id="hb-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a" stop-opacity=".5"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></linearGradient><linearGradient id="hb-door" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fde68a" stop-opacity=".95"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></linearGradient></defs>
    <rect width="1200" height="200" fill="url(#hb-sky)"/>${sparks}
    <path d="M0 150 130 96l110 44 130-60 150 70 130-50 150 56 120-44 180 38v50H0z" fill="#220c18"/>
    ${beam(330)}${beam(600)}${beam(870)}
    <path d="M0 178h1200v22H0z" fill="#12060c"/>
    ${plinth(330, 120, 56)}${plinth(600, 140, 70)}${plinth(870, 120, 56)}
    <g transform="translate(330 122)"><path d="M-30 0h60l-12-70h-36z" fill="#fb923c"/><path d="M-22-26h44l-3-16h-38zM-9-60h18l-2-10h-14z" fill="#fff" opacity=".9"/><rect x="-36" y="-2" width="72" height="8" rx="2" fill="#c2410c"/></g>
    <g transform="translate(600 108)"><g transform="translate(-48 -90) scale(3)">${cup('#9aa3b2')}</g><path d="M-8-82 4-60-6-46 6-24" fill="none" stroke="#14070f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g transform="translate(870 122)"><path d="M-34 0v-90h68v90z" fill="#14070f" stroke="#4a2b3a" stroke-width="4"/><path d="M-34-90 34-70v70l-68 6z" fill="#6b3a2a" opacity=".001"/><path d="M-30-86 18-70v70l-48 0z" fill="url(#hb-door)"/><path d="M-34-90 -2-80v86l-32-6z" fill="#7a4a35"/><circle cx="-12" cy="-42" r="3" fill="#fab219"/></g>
    <g fill="none" stroke="#f87171" stroke-width="3" stroke-linecap="round" opacity=".7"><path d="M180 60l14 14M194 60l-14 14M1010 40l12 12M1022 40l-12 12M470 28l10 10M480 28l-10 10"/></g>`,
    'shame-banner-art',
    true,
  );
};

// A medal for the top three team killers: the season's medals on a red ribbon, the cup for first place's neighbours.
const DIGITS = [
  '<path d="M14 19l2-2v8" fill="none" stroke="#3b2a05" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M13 19a3 3 0 1 1 5 2l-5 4h6" fill="none" stroke="#3b2a05" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M13 17.5h5l-3 3a3 3 0 1 1-2 5" fill="none" stroke="#3b2a05" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
];
export const shameMedal = (rank) =>
  svg(
    '0 0 32 32',
    `<path d="M9 2h5l4 11h-5zM23 2h-5l-4 11h5z" fill="#f87171" opacity=".9"/><circle cx="16" cy="21" r="9" fill="${METAL[rank - 1] ?? METAL[2]}"/><circle cx="16" cy="21" r="6.5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"/>${DIGITS[rank - 1] ?? ''}`,
    'art-medal',
  );

const ICONS = {
  // A lit bomb: team kill warnings.
  bomb: '<circle cx="14" cy="19" r="9" fill="currentColor"/><path d="M20 11l3-3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M25 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fab219"/><circle cx="11" cy="16" r="2.2" fill="#fff" opacity=".35"/>',
  // A crosshair: players warned.
  target: '<circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 3v8M16 21v8M3 16h8M21 16h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="2.2" fill="#f87171"/>',
  // An open door with an arrow out: kicked.
  door: '<path d="M6 4h12v24H6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M6 4l9 3v21l-9 0z" fill="currentColor"/><circle cx="12" cy="17" r="1.3" fill="#13161b"/><path d="M20 16h9m-3.5-3.5L29 16l-3.5 3.5" fill="none" stroke="#fab219" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  // A gavel: banned.
  gavel: '<rect x="10" y="4" width="14" height="8" rx="2" transform="rotate(40 17 8)" fill="currentColor"/><path d="M14 14 5 24" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M13 28h16" stroke="#f87171" stroke-width="3" stroke-linecap="round"/>',
  // A door with a ban sign over it: kicked, then banned.
  'door-banned': '<path d="M5 4h14v24H5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M5 4l10 3v21l-10 0z" fill="currentColor"/><circle cx="23" cy="20" r="7" fill="#13161b" stroke="#f87171" stroke-width="2.6"/><path d="M18 25l10-10" stroke="#f87171" stroke-width="2.6" stroke-linecap="round"/>',
  // A halo over a smile: nobody on the list.
  halo: '<ellipse cx="16" cy="6" rx="8" ry="2.6" fill="none" stroke="#fab219" stroke-width="2.2"/><circle cx="16" cy="19" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12.5" cy="17" r="1.2" fill="currentColor"/><circle cx="19.5" cy="17" r="1.2" fill="currentColor"/><path d="M11.5 21.5c2.5 3 6.5 3 9 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};

export const shameIcon = (name, className = 'art-glyph') => svg('0 0 32 32', ICONS[name] ?? ICONS.target, className);

// The picture for each total, in the order of shameTiles.
export const TILE_ICONS = ['bomb', 'target', 'door', 'gavel'];
// The picture for each list of the kicked and banned, by outcome.
export const OUTCOME_ICONS = { 'kicked-then-banned': 'door-banned', banned: 'gavel', kicked: 'door' };
