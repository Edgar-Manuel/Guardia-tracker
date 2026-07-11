'use client';

// Estructura común: barra superior con estado de sincronización y tema,
// navegación inferior en móvil y lateral en escritorio. Arranca el service
// worker (PWA) y la sincronización automática con Supabase.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { iniciarSyncAutomatico, onEstadoSync, type EstadoSync } from '@/lib/sync';
import {
  IconoAjustes,
  IconoAviso,
  IconoCalendario,
  IconoDescanso,
  IconoEstadisticas,
  IconoGuardia,
  IconoInforme,
  IconoInicio,
  IconoLuna,
  IconoNube,
  IconoNubeOff,
  IconoSol,
} from './Iconos';

const NAV_PRINCIPAL = [
  { href: '/', etiqueta: 'Inicio', Icono: IconoInicio },
  { href: '/avisos', etiqueta: 'Avisos', Icono: IconoAviso },
  { href: '/calendario', etiqueta: 'Calendario', Icono: IconoCalendario },
  { href: '/estadisticas', etiqueta: 'Estadísticas', Icono: IconoEstadisticas },
  { href: '/informes', etiqueta: 'Informes', Icono: IconoInforme },
];

const NAV_SECUNDARIA = [
  { href: '/guardias', etiqueta: 'Guardias', Icono: IconoGuardia },
  { href: '/descansos', etiqueta: 'Descansos', Icono: IconoDescanso },
  { href: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes },
];

const ETIQUETA_SYNC: Record<EstadoSync, string> = {
  local: 'Solo local',
  sin_sesion: 'Sin sesión',
  offline: 'Sin conexión',
  sincronizando: 'Sincronizando…',
  sincronizado: 'Sincronizado',
  error: 'Error de sincronización',
};

function BadgeSync() {
  const [estado, setEstado] = useState<EstadoSync>('local');
  useEffect(() => onEstadoSync(setEstado), []);
  const offline = estado === 'offline' || estado === 'error';
  const Icono = offline ? IconoNubeOff : IconoNube;
  return (
    <Link
      href="/ajustes"
      className={`chip border border-line ${
        offline ? 'text-serious' : estado === 'sincronizado' ? 'text-good' : 'text-ink2'
      } ${estado === 'sincronizando' ? 'pulso' : ''}`}
      title="Estado de sincronización"
    >
      <Icono className="text-base" />
      <span className="hidden sm:inline">{ETIQUETA_SYNC[estado]}</span>
    </Link>
  );
}

function BotonTema() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    setOscuro(document.documentElement.classList.contains('dark'));
  }, []);
  const alternar = () => {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    document.documentElement.classList.toggle('dark', nuevo);
    try {
      localStorage.setItem('tema', nuevo ? 'oscuro' : 'claro');
    } catch {}
  };
  return (
    <button
      onClick={alternar}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink2 hover:bg-surface-2"
      aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {oscuro ? <IconoSol className="text-lg" /> : <IconoLuna className="text-lg" />}
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();

  useEffect(() => {
    iniciarSyncAutomatico();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const activo = (href: string) => (href === '/' ? ruta === '/' : ruta.startsWith(href));

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl">
      {/* Navegación lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-1 border-r border-line p-4 md:flex">
        <Link href="/" className="mb-4 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
            <IconoGuardia className="text-xl" />
          </span>
          <span className="text-base font-bold">Guardia Tracker</span>
        </Link>
        {[...NAV_PRINCIPAL, ...NAV_SECUNDARIA].map(({ href, etiqueta, Icono }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
              activo(href) ? 'bg-primary-soft text-primary dark:text-white' : 'text-ink2 hover:bg-surface-2'
            }`}
          >
            <Icono className="text-lg" />
            {etiqueta}
          </Link>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <IconoGuardia className="text-lg" />
            </span>
            <span className="text-sm font-bold">Guardia Tracker</span>
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <BadgeSync />
            <BotonTema />
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-24 md:pb-8">{children}</main>

        {/* Navegación inferior (móvil) */}
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
            {NAV_PRINCIPAL.map(({ href, etiqueta, Icono }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                  activo(href) ? 'text-primary' : 'text-muted'
                }`}
              >
                <span
                  className={`flex h-7 w-14 items-center justify-center rounded-full text-lg transition-colors ${
                    activo(href) ? 'bg-primary-soft' : ''
                  }`}
                >
                  <Icono />
                </span>
                {etiqueta}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
