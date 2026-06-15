import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';
import { useI18n, LANGUAGES } from '../../i18n/useI18n';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = phone.startsWith('+91') ? phone : `+91${phone}`;
    await login(normalized, password);
    const storeUser = useAuthStore.getState().user;
    switch (storeUser?.userType) {
      case 'trucker':          navigate('/trucker/dashboard'); break;
      case 'merchant':         navigate('/dashboard'); break;
      case 'admin':            window.location.href = 'http://192.168.8.101:3011/admin'; break;
      case 'logistics':        navigate('/logistics/dashboard'); break;
      case 'loader_company':   navigate('/loader/dashboard'); break;
      case 'highway_business': navigate('/highway/dashboard'); break;
      default:                 navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🚛</div>
          <h1 className="text-3xl font-bold text-orange-500">TruckPlatform</h1>
          <p className="text-gray-500 mt-1 text-sm">
            One login for all — Merchant · Trucker · Loader · Highway · Admin
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('mobileNumber')}</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">+91</span>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => { setPhone(e.target.value); clearError(); }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="9876543210"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Your password"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? t('loggingIn') : t('loginButton')}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm text-gray-500 mt-5">
          {t('newHere')}{' '}
          <Link to="/register" className="text-orange-500 font-medium hover:underline">
            {t('createAccount')}
          </Link>
        </p>

        {/* Test credentials box */}
        <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-amber-700 mb-2">Test Credentials (all use Admin@123)</p>
          <p>🏪 Merchant:         9880001001</p>
          <p>🚛 Trucker:          9770001001</p>
          <p>🔧 Admin:            9990001001</p>
          <p>📦 Loader Company:   9660001001</p>
          <p>🛣️ Highway Business: 9550001001</p>
        </div>

        {/* Language selector */}
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="text-center text-xs text-gray-400 mb-2">भाषा / Language</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  lang === l.code
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700'
                }`}
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
