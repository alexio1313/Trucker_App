import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '../../src/lib/api';

export default function HighwayAnalyticsScreen() {
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<any>({ impressions: 0, clicks: 0, ctr: 0, spendTotal: 0, estimatedVisits: 0 });

  useEffect(() => {
    apiClient.get(`/highway/analytics?period=${period}`).then(d => { if (d.success) setData(d.data); }).catch(() => {});
  }, [period]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📈 Analytics</Text>
      <View style={styles.periods}>
        {['7d', '30d', '90d'].map(p => (
          <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.grid}>
        {[
          { label: 'Impressions', value: data.impressions },
          { label: 'Clicks', value: data.clicks },
          { label: 'CTR', value: `${((data.ctr || 0) * 100).toFixed(1)}%` },
          { label: 'Spend', value: `₹${(data.spendTotal || 0).toFixed(0)}` },
          { label: 'Est. Visits', value: data.estimatedVisits },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statValue}>{String(s.value)}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  periods: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#E5E7EB' },
  periodBtnActive: { backgroundColor: '#F97316' },
  periodBtnText: { fontWeight: '600', color: '#6B7280' },
  periodBtnTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
});
