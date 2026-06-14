import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { loadsApi } from '@truck-platform/api-client';
import { CreateLoadInput, TruckType, CargoType } from '@truck-platform/shared';

const TRUCK_TYPES: TruckType[] = ['mini', 'light', 'medium', 'heavy', 'trailer'];
const CARGO_TYPES: CargoType[] = ['general', 'fragile', 'hazmat', 'temperature_controlled', 'liquid', 'oversized'];

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

export default function PostLoadPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateLoadInput>(INITIAL_STATE);
  const [quoteVisible, setQuoteVisible] = useState(false);

  const quoteMutation = useMutation({
    mutationFn: () => loadsApi.getPriceQuote({
      originLat: form.origin.lat,
      originLng: form.origin.lng,
      destLat: form.destination.lat,
      destLng: form.destination.lng,
      truckType: form.truckTypeRequired,
      weightKg: form.cargo.weightKg,
      cargoType: form.cargo.cargoType,
    }),
    onSuccess: () => setQuoteVisible(true),
  });

  const createMutation = useMutation({
    mutationFn: () => loadsApi.createLoad(form),
    onSuccess: (res) => navigate(`/loads/${res.data?.loadId}`),
  });

  function setOriginField(field: string, value: string | number) {
    setForm((f) => ({ ...f, origin: { ...f.origin, [field]: value } }));
  }
  function setDestField(field: string, value: string | number) {
    setForm((f) => ({ ...f, destination: { ...f.destination, [field]: value } }));
  }
  function setCargoField(field: string, value: string | number | boolean) {
    setForm((f) => ({ ...f, cargo: { ...f.cargo, [field]: value } }));
  }

  const quote = quoteMutation.data?.data;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate();
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

          {/* Price quote widget */}
          <button
            type="button"
            onClick={() => quoteMutation.mutate()}
            disabled={!form.origin.lat || !form.destination.lat || quoteMutation.isPending}
            className="mt-3 text-sm text-orange-600 border border-orange-300 px-4 py-2 rounded-lg hover:bg-orange-50 disabled:opacity-40"
          >
            {quoteMutation.isPending ? 'Getting quote…' : 'Get AI Price Quote'}
          </button>

          {quoteVisible && quote && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="font-semibold text-orange-800">Recommended Price: ₹{quote.recommendedPrice?.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-1">
                Base: ₹{quote.breakdown?.baseFare?.toLocaleString('en-IN')} ·
                Fuel: ₹{quote.breakdown?.fuelSurcharge?.toLocaleString('en-IN')} ·
                Tolls: ₹{quote.breakdown?.tollCharges?.toLocaleString('en-IN')} ·
                {quote.breakdown?.surgeMultiplier && quote.breakdown.surgeMultiplier > 1
                  ? ` Surge: ${quote.breakdown.surgeMultiplier}x ·`
                  : ''} GST: ₹{quote.breakdown?.gst?.toLocaleString('en-IN')}
              </p>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, budgetMax: quote.recommendedPrice ?? f.budgetMax }))}
                className="mt-2 text-xs text-orange-600 hover:underline"
              >
                Use this price →
              </button>
            </div>
          )}
        </div>

        {createMutation.isError && (
          <p className="text-red-500 text-sm">Failed to post load. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Posting…' : 'Post Load'}
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
