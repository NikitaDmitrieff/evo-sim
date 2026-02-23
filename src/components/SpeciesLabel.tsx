// Latin name display component for species
// Names are generated deterministically in world.ts; this just renders them.

interface SpeciesLabelProps {
  label: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SpeciesLabel({ label, color, size = 'md' }: SpeciesLabelProps) {
  const sizeClass =
    size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <span
      className={`italic font-medium ${sizeClass}`}
      style={{ color: color ?? 'inherit' }}
    >
      {label}
    </span>
  );
}
