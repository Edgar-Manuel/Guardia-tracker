// Conjunto mínimo de iconos SVG (trazo 2, estilo Material) para no depender
// de librerías externas.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoInicio = (p: P) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </Base>
);

export const IconoAviso = (p: P) => (
  <Base {...p}>
    <path d="M14 5h4l3 4v6h-2" />
    <path d="M14 15V5H1v10" />
    <circle cx="5.5" cy="17" r="2" />
    <circle cx="16.5" cy="17" r="2" />
    <path d="M7.5 17H14.5" />
    <path d="M1 15h1.5" />
  </Base>
);

export const IconoCalendario = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 9h18" />
  </Base>
);

export const IconoEstadisticas = (p: P) => (
  <Base {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </Base>
);

export const IconoMas = (p: P) => (
  <Base {...p}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </Base>
);

export const IconoGuardia = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5M9 2h6" />
  </Base>
);

export const IconoDescanso = (p: P) => (
  <Base {...p}>
    <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
    <path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
    <path d="M7 2c0 1.2 1 1.6 1 3M11 2c0 1.2 1 1.6 1 3" />
  </Base>
);

export const IconoInforme = (p: P) => (
  <Base {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M9 13h6M9 17h6" />
  </Base>
);

export const IconoAjustes = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
  </Base>
);

export const IconoSol = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
);

export const IconoLuna = (p: P) => (
  <Base {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
  </Base>
);

export const IconoNube = (p: P) => (
  <Base {...p}>
    <path d="M17.5 19a4.5 4.5 0 0 0 .4-9A7 7 0 0 0 4.3 12.5 4 4 0 0 0 6 20h11.5Z" />
  </Base>
);

export const IconoNubeOff = (p: P) => (
  <Base {...p}>
    <path d="M17.5 19a4.5 4.5 0 0 0 .4-9A7 7 0 0 0 4.3 12.5 4 4 0 0 0 6 20h11.5Z" />
    <path d="M3 3l18 18" />
  </Base>
);

export const IconoAlerta = (p: P) => (
  <Base {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);

export const IconoMapa = (p: P) => (
  <Base {...p}>
    <path d="M12 21s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Base>
);

export const IconoMasCirculo = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Base>
);

export const IconoFlecha = (p: P) => (
  <Base {...p}>
    <path d="M9 6l6 6-6 6" />
  </Base>
);

export const IconoCerrar = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);
