interface MouraLeiteTreeProps {
  size?: number;
  className?: string;
  showSun?: boolean;
  showGround?: boolean;
}

// Árvore do logo oficial da Moura Leite, em SVG. Portada do Portal de Simulações
// (PROJETO SIMULAÇÃO/v2) sem alteração de forma ou cor, para que as duas plataformas
// apresentem a mesma marca. Trocar pelo arquivo oficial aqui, num só lugar, quando ele
// estiver disponível como imagem de verdade.
const CANOPY = '#2E9E44';
const TRUNK = '#1B4A3A';
const SUN = '#F28C1C';

export const MouraLeiteTree = ({ size = 40, className = '', showSun = false, showGround = true }: MouraLeiteTreeProps) => (
  <svg
    viewBox="0 0 200 190"
    width={size}
    height={size * (190 / 200)}
    className={className}
    role="img"
    aria-label="Moura Leite"
  >
    {showSun && <circle cx="138" cy="55" r="55" fill={SUN} />}

    {/* tronco e galhos */}
    <path
      d="M88,178 C88,160 92,150 97,142 C82,128 62,120 52,110 C48,106 50,100 55,101 C68,104 82,112 95,125 C97,118 99,112 101,106 C104,112 106,120 107,128 C118,116 132,108 145,105 C150,104 152,110 148,113 C135,120 118,128 106,140 C111,148 114,158 114,178 Z
       M108,148 C120,146 132,148 142,153 C148,156 146,163 140,161 C130,157 119,156 110,158 Z"
      fill={TRUNK}
    />

    {/* copa: aglomerado de blobs sobrepostos */}
    <g fill={CANOPY}>
      <circle cx="100" cy="72" r="46" />
      <circle cx="60" cy="88" r="36" />
      <circle cx="140" cy="82" r="38" />
      <circle cx="34" cy="108" r="28" />
      <circle cx="167" cy="103" r="30" />
      <circle cx="76" cy="40" r="30" />
      <circle cx="126" cy="38" r="28" />
      <circle cx="20" cy="130" r="22" />
      <circle cx="180" cy="126" r="20" />
      <circle cx="150" cy="151" r="15" />
    </g>

    {showGround && (
      <line x1="30" y1="182" x2="170" y2="182" stroke={TRUNK} strokeWidth="6" strokeLinecap="round" />
    )}
  </svg>
);
