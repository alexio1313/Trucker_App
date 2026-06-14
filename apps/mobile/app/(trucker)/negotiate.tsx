import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { useAuthStore } from '@truck-platform/state';

interface NegotiateResponse {
  recommendation: 'accept' | 'counter' | 'reject';
  suggestedPrice?: number;
  reasoning: string;
  riskFactors: string[];
  profitEstimate: number;
}

export default function NegotiateScreen() {
  const { loadId, offeredPrice } = useLocalSearchParams<{ loadId: string; offeredPrice: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [fuelCost, setFuelCost] = useState('');
  const [result, setResult] = useState<NegotiateResponse | null>(null);

  const adviseMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post<{ data: NegotiateResponse }>(
        `${process.env.EXPO_PUBLIC_API_URL}/ml/negotiate`,
        { loadId, offeredPrice: parseFloat(offeredPrice ?? '0'), estimatedFuelCost: parseFloat(fuelCost) },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return res.data.data;
    },
    onSuccess: (data) => setResult(data),
  });

  const RECOMMENDATION_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
    accept: { bg: '#DCFCE7', text: '#14532D', emoji: '✅' },
    counter: { bg: '#FEF9C3', text: '#713F12', emoji: '💬' },
    reject: { bg: '#FEE2E2', text: '#7F1D1D', emoji: '❌' },
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Load Advisor</Text>
        <Text style={styles.subtitle}>Should you accept this load?</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Offered Price</Text>
        <Text style={styles.priceText}>₹{parseFloat(offeredPrice ?? '0').toLocaleString('en-IN')}</Text>

        <Text style={styles.label}>Your Estimated Fuel Cost (₹)</Text>
        <TextInput
          style={styles.input}
          value={fuelCost}
          onChangeText={setFuelCost}
          keyboardType="numeric"
          placeholder="e.g. 3500"
          placeholderTextColor="#9CA3AF"
        />

        <TouchableOpacity
          style={[styles.analyzeBtn, adviseMutation.isPending && styles.btnDisabled]}
          onPress={() => adviseMutation.mutate()}
          disabled={adviseMutation.isPending || !fuelCost}
        >
          {adviseMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.analyzeBtnText}>Get AI Advice</Text>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.results}>
          {/* Recommendation banner */}
          <View style={[styles.recBanner, { backgroundColor: RECOMMENDATION_STYLES[result.recommendation].bg }]}>
            <Text style={styles.recEmoji}>{RECOMMENDATION_STYLES[result.recommendation].emoji}</Text>
            <View>
              <Text style={[styles.recTitle, { color: RECOMMENDATION_STYLES[result.recommendation].text }]}>
                {result.recommendation.charAt(0).toUpperCase() + result.recommendation.slice(1)} this load
              </Text>
              {result.suggestedPrice && (
                <Text style={styles.recSub}>
                  Suggested counter: ₹{result.suggestedPrice.toLocaleString('en-IN')}
                </Text>
              )}
            </View>
          </View>

          {/* Profit estimate */}
          <View style={styles.profitCard}>
            <Text style={styles.profitLabel}>Estimated Profit</Text>
            <Text style={[styles.profitValue, { color: result.profitEstimate >= 0 ? '#15803D' : '#DC2626' }]}>
              {result.profitEstimate >= 0 ? '+' : ''}₹{result.profitEstimate.toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Reasoning */}
          <View style={styles.reasonCard}>
            <Text style={styles.reasonTitle}>AI Analysis</Text>
            <Text style={styles.reasonText}>{result.reasoning}</Text>
          </View>

          {/* Risk factors */}
          {result.riskFactors.length > 0 && (
            <View style={styles.risksCard}>
              <Text style={styles.risksTitle}>Risk Factors</Text>
              {result.riskFactors.map((r, i) => (
                <Text key={i} style={styles.riskItem}>⚠ {r}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, paddingTop: 40, backgroundColor: '#1A1A2E' },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  card: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4, marginTop: 12 },
  priceText: { fontSize: 28, fontWeight: '700', color: '#111827' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827' },
  analyzeBtn: { marginTop: 16, backgroundColor: '#FF6B00', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  analyzeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  results: { paddingHorizontal: 16 },
  recBanner: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  recEmoji: { fontSize: 28 },
  recTitle: { fontSize: 18, fontWeight: '700' },
  recSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  profitCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center' },
  profitLabel: { fontSize: 14, color: '#6B7280' },
  profitValue: { fontSize: 32, fontWeight: '700', marginTop: 4 },
  reasonCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12 },
  reasonTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  reasonText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  risksCard: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, marginBottom: 12 },
  risksTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  riskItem: { fontSize: 13, color: '#78350F', marginBottom: 4 },
});
