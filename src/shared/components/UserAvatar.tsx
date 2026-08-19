// Avatar circular com iniciais e cor derivada do nome.
// Era `renderUserAvatar(name)` no App.jsx, passado como prop para 4 componentes.
// Extraído na F0-12 sem alteração visual: mesma paleta, mesmo hash, mesma marcação.

const COLORS = [
  'hsl(151, 80%, 25%)', // Primary green
  'hsl(160, 84%, 39%)', // Accent mint
  'hsl(210, 100%, 40%)', // Blue
  'hsl(280, 75%, 45%)', // Purple
  'hsl(36, 100%, 40%)', // Amber
  'hsl(350, 80%, 50%)', // Red
];

export const UserAvatar = ({ name }: { name: string }) => {
  if (!name) return null;

  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('');
  // Simple hash to select color
  const colorIndex = Math.abs(
    name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % COLORS.length;
  const resolvedColor = COLORS[colorIndex];

  return (
    <div className="avatar-circle" style={{ backgroundColor: resolvedColor }}>
      {initials}
    </div>
  );
};
