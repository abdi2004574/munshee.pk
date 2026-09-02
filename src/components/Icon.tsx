interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`/sprite.svg#icon-${name}`} />
    </svg>
  );
}
