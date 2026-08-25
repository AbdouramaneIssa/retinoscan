import './SvgRobot.css'

/**
 * Robot mascotte 100% SVG + CSS (aucune 3D).
 * Les bras et jambes sont des <g> séparés pour pouvoir pivoter
 * autour de leur articulation (transform-box: fill-box dans le CSS).
 *
 * Props :
 *  - marche  : balance bras/jambes (pendant un déplacement)
 *  - touched : réaction au survol (sursaut + coucou + joues roses)
 */
export default function SvgRobot({ marche = false, touched = false, width = 84 }) {
  const cls = `robot${marche ? ' walking' : ''}${touched ? ' touched' : ''}`
  return (
    <svg className={cls} width={width} height={width * 1.24} viewBox="0 0 100 124"
      fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">

      {/* ── Jambes (pivot = hanche, en haut du membre) ── */}
      <g className="leg leg-l">
        <rect x="40" y="84" width="8" height="22" rx="4" fill="#0e7490" />
        <ellipse cx="44" cy="107" rx="6.5" ry="3.6" fill="#155e75" />
      </g>
      <g className="leg leg-r">
        <rect x="52" y="84" width="8" height="22" rx="4" fill="#0e7490" />
        <ellipse cx="56" cy="107" rx="6.5" ry="3.6" fill="#155e75" />
      </g>

      {/* ── Bras (pivot = épaule, en haut du membre) ── */}
      <g className="arm arm-l">
        <rect x="26" y="54" width="7" height="20" rx="3.5" fill="#0e7490" />
        <circle cx="29.5" cy="74" r="4.6" fill="#22d3ee" />
      </g>
      <g className="arm arm-r">
        <rect x="67" y="54" width="7" height="20" rx="3.5" fill="#0e7490" />
        <circle cx="70.5" cy="74" r="4.6" fill="#22d3ee" />
      </g>

      {/* ── Corps ── */}
      <rect x="33" y="52" width="34" height="35" rx="10" fill="#0891b2" />
      {/* petit écran sur le ventre */}
      <rect x="40" y="61" width="20" height="13" rx="4" fill="#0e7490" />
      <circle cx="46" cy="67.5" r="1.7" fill="#67e8f9" />
      <circle cx="54" cy="67.5" r="1.7" fill="#67e8f9" />

      {/* ── Cou ── */}
      <rect x="45" y="46" width="10" height="8" fill="#0e7490" />

      {/* ── Antenne ── */}
      <line x1="50" y1="17" x2="50" y2="7" stroke="#67e8f9" strokeWidth="2.4" strokeLinecap="round" />
      <circle className="antenna-ball" cx="50" cy="5" r="3.2" fill="#fde047" />

      {/* ── Tête ── */}
      <rect x="27" y="16" width="46" height="34" rx="13" fill="#06b6d4" />

      {/* Joues (visibles au survol) */}
      <circle className="cheek" cx="34" cy="39" r="3.4" fill="#fb7185" />
      <circle className="cheek" cx="66" cy="39" r="3.4" fill="#fb7185" />

      {/* Yeux (clignent) */}
      <g className="eyes">
        <circle cx="41" cy="32" r="5.6" fill="white" />
        <circle cx="59" cy="32" r="5.6" fill="white" />
        <circle cx="41.9" cy="32.6" r="2.7" fill="#0f172a" />
        <circle cx="59.9" cy="32.6" r="2.7" fill="#0f172a" />
      </g>

      {/* Sourire */}
      <path d="M42 41 Q50 47 58 41" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}
