import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';

type UserType = 'merchant' | 'trucker' | 'logistics' | 'loader_company' | 'highway_business';

const ROLES: { type: UserType; label: string; icon: string; desc: string }[] = [
  { type: 'merchant', label: 'Merchant / Shipper', icon: '🏪', desc: 'Post loads and track shipments' },
  { type: 'logistics', label: 'Logistics Company / Fleet Owner', icon: '🚚', desc: 'Manage fleet and bid on loads' },
  { type: 'trucker', label: 'Truck Driver', icon: '🚛', desc: 'Find loads and earn money' },
  { type: 'loader_company', label: 'Loading / Labour Company', icon: '💪', desc: 'Provide loading services' },
  { type: 'highway_business', label: 'Highway Business (Dhaba / Fuel / etc.)', icon: '⛽', desc: 'List your business on the driver map' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'ta', label: 'தமிழ்' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [lang, setLang] = useState('en');
  const [selectedRole, setSelectedRole] = useState<UserType | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [aadhaarStep, setAadhaarStep] = useState<'choose' | 'manual' | 'digilocker'>('choose');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarTxn, setAadhaarTxn] = useState('');
  const [kycDone, setKycDone] = useState(false);

  // Role-specific step 4 fields
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [businessType, setBusinessType] = useState('dhaba');
  const [businessLat, setBusinessLat] = useState('');
  const [businessLng, setBusinessLng] = useState('');

  const API = '/api/v1';

  async function handleSendOtp() {
    const resp = await fetch(`${API}/kyc/aadhaar/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaarNumber }),
    });
    const data = await resp.json();
    if (data.success) { setAadhaarTxn(data.data.transactionId); setAadhaarStep('manual'); }
  }

  async function handleVerifyOtp() {
    const resp = await fetch(`${API}/kyc/aadhaar/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: aadhaarTxn, otp: aadhaarOtp }),
    });
    const data = await resp.json();
    if (data.success) { setKycDone(true); setStep(4); }
  }

  async function handleDigilocker() {
    const resp = await fetch(`${API}/kyc/digilocker/auth-url`);
    const data = await resp.json();
    if (data.success) { window.location.href = data.data.authUrl; }
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = phone.startsWith('+91') ? phone : `+91${phone}`;
    await register(normalized, password, fullName, selectedRole!);
    const storeUser = useAuthStore.getState().user;
    if (!storeUser) return;
    const redirects: Record<string, string> = {
      merchant: '/dashboard',
      trucker: '/trucker/dashboard',
      admin: 'http://192.168.8.101:3011/admin',
      logistics: '/logistics/dashboard',
      loader_company: '/loader/dashboard',
      highway_business: '/highway/dashboard',
    };
    navigate(redirects[storeUser.userType] || '/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <div className="text-center flex-1">
            <div className="text-3xl mb-1">🚛</div>
            <h1 className="text-2xl font-bold text-orange-500">TruckPlatform</h1>
            <p className="text-gray-500 text-sm">Step {step} of 4</p>
          </div>
          <select value={lang} onChange={e => setLang(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        {/* Step 1: Role Selection */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Select your role</h2>
            <div className="space-y-3">
              {ROLES.map(r => (
                <button
                  key={r.type}
                  onClick={() => { setSelectedRole(r.type); setStep(2); }}
                  className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all text-left"
                >
                  <span className="text-2xl">{r.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-800">{r.label}</div>
                    <div className="text-xs text-gray-500">{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-4">Already have an account? <Link to="/login" className="text-orange-500 font-medium">Login</Link></p>
          </div>
        )}

        {/* Step 2: Phone + Password */}
        {step === 2 && (
          <form onSubmit={e => { e.preventDefault(); setStep(3); }} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Your details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Your full name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">+91</span>
                <input type="tel" maxLength={10} value={phone} onChange={e => { setPhone(e.target.value); clearError(); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="9876543210" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Minimum 8 characters" minLength={8} required />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50">Back</button>
              <button type="submit" className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600">Next</button>
            </div>
          </form>
        )}

        {/* Step 3: Aadhaar eKYC */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Verify your identity</h2>
            <p className="text-sm text-gray-500">Government-mandated KYC for all platform users</p>

            {aadhaarStep === 'choose' && (
              <div className="space-y-3">
                <button onClick={handleDigilocker} className="w-full flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 transition-all text-left">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <div className="font-semibold text-blue-800">Verify with DigiLocker</div>
                    <div className="text-xs text-blue-600">Faster — fetches all documents in one go (Recommended)</div>
                  </div>
                </button>
                <button onClick={() => setAadhaarStep('manual')} className="w-full flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-all text-left">
                  <span className="text-2xl">📱</span>
                  <div>
                    <div className="font-semibold text-gray-800">Enter Aadhaar manually</div>
                    <div className="text-xs text-gray-600">Verify via OTP sent to registered mobile</div>
                  </div>
                </button>
                <button onClick={() => setStep(1)} className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50">Back</button>
              </div>
            )}

            {aadhaarStep === 'manual' && !aadhaarTxn && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number</label>
                  <input type="text" maxLength={12} value={aadhaarNumber} onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, ''))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="12-digit Aadhaar number" />
                </div>
                <button onClick={handleSendOtp} disabled={aadhaarNumber.length !== 12} className="w-full bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50">Send OTP</button>
                <button onClick={() => setAadhaarStep('choose')} className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg">Back</button>
              </div>
            )}

            {aadhaarStep === 'manual' && aadhaarTxn && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OTP sent to your Aadhaar-linked mobile</label>
                  <input type="text" maxLength={6} value={aadhaarOtp} onChange={e => setAadhaarOtp(e.target.value.replace(/\D/g, ''))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="6-digit OTP" />
                </div>
                <button onClick={handleVerifyOtp} disabled={aadhaarOtp.length !== 6} className="w-full bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50">Verify OTP</button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Role-specific details */}
        {step === 4 && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedRole === 'merchant' && 'Business details'}
              {selectedRole === 'trucker' && 'Your driving licence'}
              {selectedRole === 'logistics' && 'Company details'}
              {selectedRole === 'loader_company' && 'Company registration'}
              {selectedRole === 'highway_business' && 'Business location'}
            </h2>

            {(selectedRole === 'merchant' || selectedRole === 'logistics' || selectedRole === 'loader_company') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Company name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                  <input type="text" value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())} maxLength={15} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="22AAAAA0000A1Z5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                  <input type="text" value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} maxLength={10} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="ABCDE1234F" />
                </div>
              </>
            )}

            {selectedRole === 'trucker' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driving Licence Number</label>
                <input type="text" value={dlNumber} onChange={e => setDlNumber(e.target.value.toUpperCase())} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="KA0120001234567" />
                <p className="text-xs text-gray-400 mt-1">You can add your truck details after registration</p>
              </div>
            )}

            {selectedRole === 'highway_business' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                  <select value={businessType} onChange={e => setBusinessType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="dhaba">Dhaba / Restaurant</option>
                    <option value="fuel_station">Fuel Station</option>
                    <option value="truck_stop">Truck Stop / Parking</option>
                    <option value="tyre_shop">Tyre Shop</option>
                    <option value="service_center">Service Center / Mechanic</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input type="number" step="any" value={businessLat} onChange={e => setBusinessLat(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="12.9716" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input type="number" step="any" value={businessLng} onChange={e => setBusinessLng(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="77.5946" required />
                  </div>
                </div>
                <p className="text-xs text-gray-400">You can choose subscription plan after your listing is live</p>
              </>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(3)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50">Back</button>
              <button type="submit" disabled={isLoading} className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50">
                {isLoading ? 'Creating account…' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
