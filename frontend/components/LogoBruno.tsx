import React from 'react';

interface LogoBrunoProps {
  size?: number;
  className?: string;
}

/**
 * Renderiza el logo oficial de Remises Bruno (/LogoBruno.jpg)
 * recortado en círculo perfecto (ocultando el fondo cuadrado gris de las esquinas).
 */
export default function LogoBruno({ size = 40, className = '' }: LogoBrunoProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full overflow-hidden shrink-0 shadow-md ring-2 ring-white/20 bg-[#9b080d] inline-flex items-center justify-center select-none ${className}`}
    >
      <img
        src="/LogoBruno.jpg"
        alt="Remises Bruno Logo"
        className="w-full h-full object-cover scale-[1.05]"
        draggable={false}
      />
    </div>
  );
}
