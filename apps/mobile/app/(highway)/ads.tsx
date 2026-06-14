import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '../../src/lib/api';

export default function HighwayAdsScreen() {
  const [ads, setAds] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('/highway/ads').then(d => { if (d.success) setAds(d.data); }).catch(() => {});
  }, []);

  async function toggleAd(id: string, status: string) {
    const newStatus = status === 'active' ? 'paused' : 'active';
    await apiClient.put(`/highway/ads/${id}`, { status: newStatus });
    setAds(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📢 Ad Campaigns</Text>
      {ads.length === 0 ? (
        <Text style={styles.empty}>No campaigns yet. Create them on the web portal.</Text>
      ) : ads.map(ad => (
        <View key={ad.id} style={styles.adCard}>
          <View style={styles.adHeader}>
            <Text style={styles.adTitle}>{ad.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: ad.status === 'active' ? '#D1FAE5' : '#F3F4F6' }]}>
              <Text style={[styles.statusText, { color: ad.status === 'active' ? '#059669' : '#6B7280' }]}>{ad.status}</Text>
            </View>
          </View>
          <View style={styles.adStats}>
            <Text style={styles.adStat}>👁️ {ad.impressions}</Text>
            <Text style={styles.adStat}>👆 {ad.clicks}</Text>
            <Text style={styles.adStat}>💸 ₹{(ad.spentTotal || 0).toFixed(0)}</Text>
          </View>
          <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleAd(ad.id, ad.status)}>
            <Text style={styles.toggleBtnText}>{ad.status === 'active' ? 'Pause' : 'Resume'}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  adCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  adHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  adTitle: { fontWeight: '600', color: '#111827', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '500' },
  adStats: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  adStat: { fontSize: 13, color: '#374151' },
  toggleBtn: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  toggleBtnText: { fontWeight: '600', color: '#374151', fontSize: 13 },
});
