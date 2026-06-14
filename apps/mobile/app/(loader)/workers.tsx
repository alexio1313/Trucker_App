import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '../../src/lib/api';

export default function LoaderWorkersScreen() {
  const [workers, setWorkers] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('/loader-cos/workers').then(d => { if (d.success) setWorkers(d.data); }).catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>👷 Workers ({workers.length})</Text>
      {workers.map(w => (
        <View key={w.id} style={styles.workerCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{w.name?.charAt(0)}</Text></View>
          <View style={styles.info}>
            <Text style={styles.name}>{w.name}</Text>
            <Text style={styles.phone}>{w.phone}</Text>
            <View style={styles.tags}>
              {w.skillTags?.map((s: string) => <Text key={s} style={styles.tag}>{s.replace(/_/g, ' ')}</Text>)}
            </View>
          </View>
          <View>
            <Text style={styles.jobs}>{w.totalAssignments} jobs</Text>
            {w.aadhaarVerified && <Text style={styles.verified}>✅</Text>}
          </View>
        </View>
      ))}
      {workers.length === 0 && <Text style={styles.empty}>No workers. Add them via the web portal.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  workerCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FED7AA', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#EA580C' },
  info: { flex: 1 },
  name: { fontWeight: '600', color: '#111827' },
  phone: { fontSize: 12, color: '#6B7280' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: { fontSize: 10, backgroundColor: '#DBEAFE', color: '#1D4ED8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  jobs: { fontWeight: '600', color: '#374151', textAlign: 'right' },
  verified: { textAlign: 'right', marginTop: 2 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});
