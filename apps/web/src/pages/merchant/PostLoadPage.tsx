import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadsApi } from '@truck-platform/api-client';
import { CreateLoadInput, TruckType, CargoType } from '@truck-platform/shared';
import { useAuthStore } from '@truck-platform/state';

const TRUCK_TYPES: TruckType[] = ['mini', 'light', 'medium', 'heavy', 'trailer'];
const CARGO_TYPES: CargoType[] = ['general', 'fragile', 'hazmat', 'temperature_controlled', 'liquid', 'oversized'];
const LOADER_API = 'http://192.168.8.101:3002/api/v1/loader-cos';

const INITIAL_STATE: CreateLoadInput = {
  origin: { lat: 0, lng: 0, address: '', city: '', state: '' },
  destination: { lat: 0, lng: 0, address: '', city: '', state: '' },
  cargo: { weightKg: 0, cargoType: 'general', description: '' },
  truckTypeRequired: 'medium',
  pickupTime: { earliest: '', latest: '' },
  deliveryTime: { earliest: '', latest: '' },
  budgetMin: 0,
  budgetMax: 0,
};

interface LoaderCompany {
  id: string;
  companyName: string;
  avgRating: number;
  rateCard: any;
  phone: string;
  subscriptionTier?: string;
}

export default function PostLoadPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userId = user?.userId || user?.user_id || '';
  const [form, setForm] = useState<CreateLoadInput>(INITIAL_STATE);
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Loading arrangement state
  const [needLoaders, setNeedLoaders] = useState(false);
  const [arrangementType, setArrangementType] = useState<'merchant_arranged' | 'platform_arranged'>('merchant_arranged');
  const [detentionRate, setDetentionRate] = useState(75);
  const [selectedLoaderCompanyId, setSelectedLoaderCompanyId] = useState<string | null>(null);
  const [loaderCompanies, setLoaderCompanies] = useState<LoaderCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Fetch loader companies when origin city is set and loaders are needed
  useEffect(() => {
    if (!needLoaders || !form.origin.city) {
      setLoaderCompanies([]);
      return;
    }
    setLoadingCompanies(true);
    setSelectedLoaderCompanyId(null);
    fetch(`${LOADER_API}/near?city=${encodeURIComponent(form.origin.city)}`)
      .then(r => r.json())
      .then(json => { if (json.success) setLoaderCompanies(json.data || []); })
      .catch(() => {})
      .finally(() => setLoadingCompanies(false));
  }, [needLoaders, form.origin.city]);

  function setOriginField(field: string, value: string | number) {
    setForm((f) => ({ ...f, origin: { ...f.origin, [field]: value } }));
  }
  function setDestField(field: string, value: string | number) {
    setForm((f) => ({ ...f, destination: { ...f.destination, [field]: value } }));
  }
  function setCargoField(field: string, value: string | number | boolean) {
    setForm((f) => ({ ...f, cargo: { ...f.cargo, [field]: value } }));
  }

  async function handleGetQuote() {
    if (!form.origin.lat || !form.destination.lat) return;
    setQuoteLoading(true);
    try {
      const res = await loadsApi.getPriceQuote({
        originLat: form.origin.lat,
        originLng: form.origin.lng,
        destLat: form.destination.lat,
        destLng: form.destination.lng,
        truckType: form.truckTypeRequired,
        weightKg: form.cargo.weightKg,
        cargoType: form.cargo.cargoType,
      });
      setQuoteData(res.data);
      setQuoteVisible(true);
    } catch { /* ignore */ }
    finally { setQuoteLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await loadsApi.createLoad(form);
      const loadId = res.data?.loadId;
      if (!loadId) throw new Error('No load ID returned');

      if (needLoaders) {
        await fetch(`${LOADER_API}/loads/${loadId}/setup`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            arrangementType,
            detentionRate,
            loaderCompanyId: arrangementType === 'platform_arranged' ? selectedLoaderCompanyId : null,
          }),
        });
      }

      navigate(`/loads/${loadId}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to post load. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Post a Load</h2>
        <p className="text-gray-500 mt-1">Fill in the details and we'll match you with the best trucker</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Origin */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Pickup Location</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
              <input
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.origin.city}
                onChange={(e) => setOriginField('city', e.target.value)}
                placeholder="Mumbai"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
              <input
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.origin.state}
                onChange={(e) => setOriginField('state', e.target.value)}
                placeholder="Maharashtra"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Address *</label>
              <input
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.origin.address}
                onChange={(e) => setOriginField('address', e.target.value)}
                placeholder="Warehouse No. 5, MIDC..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Latitude *</label>
              <input
                required
                type="number"
                step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.origin.lat || ''}
                onChange={(e) => setOriginField('lat', parseFloat(e.target.value))}
                placeholder="19.0760"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitude *</label>
              <input
                required
                type="number"
                step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.origin.lng || ''}
                onChange={(e) => setOriginField('lng', parseFloat(e.target.value))}
                placeholder="72.8777"
              />
            </div>
          </div>
        </div>

        {/* Destination */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Delivery Location</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
              <input
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.destination.city}
                onChange={(e) => setDestField('city', e.target.value)}
                placeholder="Delhi"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
              <input
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.destination.state}
                onChange={(e) => setDestField('state', e.target.value)}
                placeholder="Delhi"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Address *</label>
              <input
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.destination.address}
                onChange={(e) => setDestField('address', e.target.value)}
                placeholder="Plot 12, Okhla Industrial..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Latitude *</label>
              <input
                required
                type="number"
                step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.destination.lat || ''}
                onChange={(e) => setDestField('lat', parseFloat(e.target.value))}
                placeholder="28.6139"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitude *</label>
              <input
                required
                type="number"
                step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.destination.lng || ''}
                onChange={(e) => setDestField('lng', parseFloat(e.target.value))}
                placeholder="77.2090"
              />
            </div>
          </div>
        </div>

        {/* Cargo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Cargo Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Weight (kg) *</label>
              <input
                required
                type="number"
                min={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.cargo.weightKg || ''}
                onChange={(e) => setCargoField('weightKg', parseFloat(e.target.value))}
                placeholder="5000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cargo Type *</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.cargo.cargoType}
                onChange={(e) => setCargoField('cargoType', e.target.value as CargoType)}
              >
                {CARGO_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.cargo.description}
                onChange={(e) => setCargoField('description', e.target.value)}
                placeholder="Brief description of goods"
              />
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.cargo.hazmat} onChange={(e) => setCargoField('hazmat', e.target.checked)} />
              Hazardous material
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.cargo.temperatureControlled} onChange={(e) => setCargoField('temperatureControlled', e.target.checked)} />
              Temperature controlled
            </label>
          </div>
        </div>

        {/* Truck & Schedule */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Truck & Schedule</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Truck Type Required</label>
              <div className="flex gap-2 flex-wrap">
                {TRUCK_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, truckTypeRequired: t }))}
                    className={`px-3 py-1.5 text-sm rounded-lg border ${
                      form.truckTypeRequired === t ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pickup From *</label>
              <input
                required
                type="datetime-local"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.pickupTime.earliest}
                onChange={(e) => setForm((f) => ({ ...f, pickupTime: { ...f.pickupTime, earliest: e.target.value } }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pickup By *</label>
              <input
                required
                type="datetime-local"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.pickupTime.latest}
                onChange={(e) => setForm((f) => ({ ...f, pickupTime: { ...f.pickupTime, latest: e.target.value } }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deliver By *</label>
              <input
                required
                type="datetime-local"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.deliveryTime.latest}
                onChange={(e) => setForm((f) => ({ ...f, deliveryTime: { ...f.deliveryTime, latest: e.target.value } }))}
              />
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Budget (INR)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minimum Budget</label>
              <input
                type="number"
                min={0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.budgetMin || ''}
                onChange={(e) => setForm((f) => ({ ...f, budgetMin: parseFloat(e.target.value) }))}
                placeholder="8000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Maximum Budget</label>
              <input
                type="number"
                min={0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.budgetMax || ''}
                onChange={(e) => setForm((f) => ({ ...f, budgetMax: parseFloat(e.target.value) }))}
                placeholder="12000"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGetQuote}
            disabled={!form.origin.lat || !form.destination.lat || quoteLoading}
            className="mt-3 text-sm text-orange-600 border border-orange-300 px-4 py-2 rounded-lg hover:bg-orange-50 disabled:opacity-40"
          >
            {quoteLoading ? 'Getting quote…' : 'Get AI Price Quote'}
          </button>

          {quoteVisible && quoteData && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="font-semibold text-orange-800">Recommended Price: ₹{quoteData.recommendedPrice?.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-1">
                Base: ₹{quoteData.breakdown?.baseFare?.toLocaleString('en-IN')} ·
                Fuel: ₹{quoteData.breakdown?.fuelSurcharge?.toLocaleString('en-IN')} ·
                Tolls: ₹{quoteData.breakdown?.tollCharges?.toLocaleString('en-IN')} ·
                {quoteData.breakdown?.surgeMultiplier && quoteData.breakdown.surgeMultiplier > 1
                  ? ` Surge: ${quoteData.breakdown.surgeMultiplier}x ·`
                  : ''} GST: ₹{quoteData.breakdown?.gst?.toLocaleString('en-IN')}
              </p>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, budgetMax: quoteData.recommendedPrice ?? f.budgetMax }))}
                className="mt-2 text-xs text-orange-600 hover:underline"
              >
                Use this price →
              </button>
            </div>
          )}
        </div>

        {/* Loading Arrangement */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Loading Arrangement</h3>
              <p className="text-xs text-gray-500 mt-0.5">Do you need labour/loaders at the pickup location?</p>
            </div>
            <button
              type="button"
              onClick={() => setNeedLoaders(!needLoaders)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                needLoaders ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                needLoaders ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {needLoaders && (
            <div className="space-y-4">
              {/* Arrangement type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Arrangement Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setArrangementType('merchant_arranged')}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${
                      arrangementType === 'merchant_arranged' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">Self-Arranged</p>
                    <p className="text-xs text-gray-500 mt-0.5">I'll arrange my own loaders</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setArrangementType('platform_arranged')}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${
                      arrangementType === 'platform_arranged' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">Book via Platform</p>
                    <p className="text-xs text-gray-500 mt-0.5">Select a loader company below</p>
                  </button>
                </div>
              </div>

              {/* Detention rate */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Detention Rate (₹/hr)
                  <span className="ml-1 text-gray-400 font-normal">— charged if loading exceeds 2-hour free window</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={500}
                    className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={detentionRate}
                    onChange={(e) => setDetentionRate(parseFloat(e.target.value) || 75)}
                  />
                  <div className="flex gap-2">
                    {[50, 75, 100, 150].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setDetentionRate(r)}
                        className={`px-2.5 py-1 text-xs rounded-lg border ${
                          detentionRate === r ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500'
                        }`}
                      >
                        ₹{r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Loader company picker */}
              {arrangementType === 'platform_arranged' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Select Loader Company
                    {form.origin.city ? ` near ${form.origin.city}` : ' — enter pickup city first'}
                  </label>
                  {loadingCompanies && (
                    <p className="text-sm text-gray-400 py-3">Searching loader companies…</p>
                  )}
                  {!loadingCompanies && loaderCompanies.length === 0 && form.origin.city && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                      No loader companies found in {form.origin.city}. Platform will auto-assign or you can change to self-arranged.
                    </div>
                  )}
                  {loaderCompanies.length > 0 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setSelectedLoaderCompanyId(null)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                          selectedLoaderCompanyId === null ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-700">Auto-assign best available</p>
                        <p className="text-xs text-gray-500">Platform selects based on rating & availability</p>
                      </button>
                      {loaderCompanies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedLoaderCompanyId(c.id)}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                            selectedLoaderCompanyId === c.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-800">{c.companyName}</p>
                            <div className="flex items-center gap-2">
                              {c.subscriptionTier === 'premium' && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">⭐ Premium</span>
                              )}
                              {c.avgRating > 0 && (
                                <span className="text-xs text-gray-500">★ {parseFloat(String(c.avgRating)).toFixed(1)}</span>
                              )}
                            </div>
                          </div>
                          {c.rateCard && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Rate: ₹{c.rateCard.perDay || c.rateCard.per_day || '—'}/day
                            </p>
                          )}
                          {c.phone && (
                            <p className="text-xs text-blue-600 mt-0.5">📞 {c.phone}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                <strong>How it works:</strong> After the trucker arrives at pickup, a 2-hour free loading window begins.
                If loading takes longer, detention charges of ₹{detentionRate}/hr apply.
                You'll see a live detention timer on the load detail page.
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <p className="text-red-500 text-sm">{submitError}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Posting…' : 'Post Load'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/loads')}
            className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
