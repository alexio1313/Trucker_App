import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Link } from 'expo-router';
import { apiClient } from '../../src/lib/api';
import { useState, useEffect } from 'react';

export default function HighwayDashboardScreen() {
  const [stats, setStats] = useState({ impressions: 0, clicks: 0, creditsBalance: 0, activeAds: 0 });
  const [status, setStatus] = useState<'open' | 'closed' | 'busy'>('open');

  useEffect(() => {
    apiClient.get('/highway/analytics?period=7d').then(d => { if (d.success) setStats(d.data); }).catch(() => {});
  }, []);

  async function updateStatus(s: 'open' | 'closed' | 'busy') {
    setStatus(s);
    await apiClient.patch('/highway/me/status', { currentStatus: s });
  }

  const statusColors: Record<string, string> = { open: '#059669', closed: '#EF4444', busy: '#D97706' };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⛽ Highway Dashboard</Text>
        <View style={styles.statusRow}>
          {(['open', 'closed', 'busy'] as const).map(s => (
            <TouchableOpacity key={s} style={[styles.statusBtn, { backgroundColor: status === s ? statusColors[s] : '#E5E7EB' }]} onPress={() => updateStatus(s)}>
              <Text style={[styles.statusBtnText, { color: status === s ? '#fff' : '#6B7280' }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.statsGrid}>
        {[
          { label: 'Impressions (7d)', value: String(stats.impressions) },
          { label: 'Clicks (7d)', value: String(stats.clicks) },
          { label: 'Credits', value: `₹${(stats.creditsBalance || 0).toFixed(0)}` },
          { label: 'Active Ads', value: String(stats.activeAds) },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Link href="/(highway)/ads" asChild>
          <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionBtnText}>📢 Manage Ads</Text></TouchableOpacity>
        </Link>
        <Link href="/(highway)/analytics" asChild>
          <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionBtnText}>📈 Analytics</Text></TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  statusBtnText: { fontWeight: '600', fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  actions: { gap: 10 },
  actionBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  actionBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});
