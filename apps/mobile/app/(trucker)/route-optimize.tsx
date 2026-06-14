import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { useAuthStore } from '@truck-platform/state';

interface RouteOption {
  routeName: string;
  distanceKm: number;
  estimatedHours: number;
  tollCost: number;
  fuelCost: number;
  highlights: string[];
  warnings: string[];
}

interface RouteOptimizeResponse {
  routes: RouteOption[];
  recommendation: string;
  aiExplanation: string;
}

export default function RouteOptimizeScreen() {
  const { loadId } = useLocalSearchParams<{ loadId: string }>();
  const [result, setResult] = useState<RouteOptimizeResponse | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post<{ data: RouteOptimizeResponse }>(
        `${process.env.EXPO_PUBLIC_API_URL}/ml/route-optimize`,
        { loadId },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return res.data.data;
    },
    onSuccess: (data) => setResult(data),
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Route Optimizer</Text>
        <Text style={styles.subtitle}>Get AI-powered route suggestions for Indian roads</Text>
      </View>

      <TouchableOpacity
        style={[styles.optimizeBtn, optimizeMutation.isPending && styles.btnDisabled]}
        onPress={() => optimizeMutation.mutate()}
        disabled={optimizeMutation.isPending}
      >
        {optimizeMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.optimizeBtnText}>Optimize Route with AI</Text>
        )}
      </TouchableOpacity>

      {result && (
        <View style={styles.results}>
          {/* AI explanation */}
          <View style={styles.aiCard}>
            <Text style={styles.aiLabel}>AI Recommendation</Text>
            <Text style={styles.aiText}>{result.aiExplanation}</Text>
          </View>

          {/* Route options */}
          {result.routes.map((route, i) => (
            <View
              key={i}
              style={[styles.routeCard, result.recommendation === route.routeName && styles.routeCardBest]}
            >
              {result.recommendation === route.routeName && (
                <View style={styles.bestBadge}>
                  <Text style={styles.bestBadgeText}>Recommended</Text>
                </View>
              )}

              <Text style={styles.routeName}>{route.routeName}</Text>

              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{Math.round(route.distanceKm)}km</Text>
                  <Text style={styles.metricLabel}>Distance</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{route.estimatedHours.toFixed(1)}h</Text>
                  <Text style={styles.metricLabel}>Est. Time</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>₹{route.tollCost.toLocaleString('en-IN')}</Text>
                  <Text style={styles.metricLabel}>Tolls</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>₹{route.fuelCost.toLocaleString('en-IN')}</Text>
                  <Text style={styles.metricLabel}>Fuel Est.</Text>
                </View>
              </View>

              {route.highlights.length > 0 && (
                <View style={styles.highlights}>
                  {route.highlights.map((h, j) => (
                    <Text key={j} style={styles.highlightText}>✓ {h}</Text>
                  ))}
                </View>
              )}

              {route.warnings.length > 0 && (
                <View style={styles.warnings}>
                  {route.warnings.map((w, j) => (
                    <Text key={j} style={styles.warningText}>⚠ {w}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
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
  optimizeBtn: { margin: 16, backgroundColor: '#FF6B00', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  optimizeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  results: { paddingHorizontal: 16 },
  aiCard: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, marginBottom: 12 },
  aiLabel: { fontSize: 12, fontWeight: '700', color: '#1E40AF', marginBottom: 6 },
  aiText: { fontSize: 14, color: '#1E3A5F', lineHeight: 20 },
  routeCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  routeCardBest: { borderColor: '#FF6B00', borderWidth: 2 },
  bestBadge: { backgroundColor: '#FF6B00', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  bestBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  routeName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metric: { alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  metricLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  highlights: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, gap: 4 },
  highlightText: { fontSize: 13, color: '#15803D' },
  warnings: { borderTopWidth: 1, borderTopColor: '#FEF9C3', paddingTop: 10, gap: 4, marginTop: 8 },
  warningText: { fontSize: 13, color: '#A16207' },
});
