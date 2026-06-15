import { useState, useRef, useEffect } from 'react';
import { useI18n, LANGUAGES } from '../i18n/useI18n';

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find(l => l.code === lang);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors ${compact ? 'text-xs' : 'text-sm'} font-medium`}
      >
        <span>🌐</span>
        <span>{current?.native ?? 'EN'}</span>
        <span className="text-slate-500">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-slate-700 ${lang === l.code ? 'text-orange-400 font-semibold' : 'text-slate-300'}`}
            >
              <span>{l.native}</span>
              <span className="text-xs text-slate-500">{l.label}</span>
              {lang === l.code && <span className="text-orange-400 ml-1">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
