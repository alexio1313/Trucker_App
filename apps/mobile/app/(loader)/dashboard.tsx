import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { useState, useEffect } from 'react';
import { apiClient } from '../../src/lib/api';

export default function LoaderDashboardScreen() {
  const [stats, setStats] = useState({ jobsThisMonth: 0, totalEarnings: 0, avgRating: 0, workersActive: 0 });

  useEffect(() => {
    apiClient.get('/loader-cos/analytics').then(d => { if (d.success) setStats(d.data); }).catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💪 Loader Dashboard</Text>
      <View style={styles.grid}>
        {[
          { label: 'Jobs This Month', value: String(stats.jobsThisMonth), icon: '📦' },
          { label: 'Total Earnings', value: `₹${(stats.totalEarnings || 0).toLocaleString('en-IN')}`, icon: '💰' },
          { label: 'Avg Rating', value: `${(stats.avgRating || 0).toFixed(1)} ⭐`, icon: '⭐' },
          { label: 'Active Workers', value: String(stats.workersActive), icon: '👷' },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statIcon}>{s.icon}</Text>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.links}>
        <Link href="/(loader)/workers" asChild><TouchableOpacity style={styles.linkBtn}><Text style={styles.linkBtnText}>👷 Manage Workers</Text></TouchableOpacity></Link>
        <Link href="/(loader)/jobs" asChild><TouchableOpacity style={styles.linkBtn}><Text style={styles.linkBtnText}>📋 Available Jobs</Text></TouchableOpacity></Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center' },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  links: { gap: 10 },
  linkBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  linkBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});
