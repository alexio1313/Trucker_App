import { useI18n, LANGUAGES } from '../i18n/useI18n';

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const current = LANGUAGES.find(l => l.code === lang);

  return (
    <div className="relative group">
      <button
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
        title={t('language')}
      >
        <span>🌐</span>
        <span>{current?.native ?? 'EN'}</span>
        <span className="text-slate-500">▾</span>
      </button>
      <div className="absolute bottom-full mb-2 left-0 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 hidden group-hover:block z-50">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-slate-700 ${lang === l.code ? 'text-orange-400 font-semibold' : 'text-slate-300'}`}
          >
            <span>{l.native}</span>
            {lang === l.code && <span className="text-orange-400">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
