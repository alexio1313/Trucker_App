import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '../../src/lib/api';

export default function LoaderJobsScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [tab, setTab] = useState('pending');

  useEffect(() => {
    apiClient.get(`/loader-cos/jobs?status=${tab}`).then(d => { if (d.success) setJobs(d.data || []); }).catch(() => {});
  }, [tab]);

  async function expressInterest(loadId: string) {
    await apiClient.post(`/loader-cos/jobs/${loadId}/express-interest`, {});
    Alert.alert('Done', 'Interest expressed! Merchant can now see your company.');
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📋 Jobs</Text>
      <View style={styles.tabs}>
        {['pending', 'active', 'completed'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {jobs.map(j => (
        <View key={j.id} style={styles.jobCard}>
          <Text style={styles.jobTitle}>{j.cargoType} — {j.originCity}</Text>
          <Text style={styles.jobSub}>{j.originAddress}</Text>
          <Text style={styles.jobWeight}>{j.weightTonnes}T</Text>
          {tab === 'pending' && (
            <TouchableOpacity style={styles.interestBtn} onPress={() => expressInterest(j.loadId)}>
              <Text style={styles.interestBtnText}>Express Interest</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {jobs.length === 0 && <Text style={styles.empty}>No {tab} jobs in your coverage area</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#E5E7EB' },
  tabActive: { backgroundColor: '#F97316' },
  tabText: { fontWeight: '600', color: '#6B7280', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  jobCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  jobTitle: { fontWeight: '600', color: '#111827' },
  jobSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  jobWeight: { fontWeight: '700', color: '#3B82F6', marginTop: 4 },
  interestBtn: { backgroundColor: '#F97316', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  interestBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});
