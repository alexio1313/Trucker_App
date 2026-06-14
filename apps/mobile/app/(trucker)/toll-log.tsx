import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiClient } from '../../src/lib/api';

export default function TollLogScreen() {
  const { loadId, journeyLogId } = useLocalSearchParams<{ loadId: string; journeyLogId: string }>();
  const [plazaName, setPlazaName] = useState('');
  const [highwayCode, setHighwayCode] = useState('');
  const [stateName, setStateName] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('fastag');
  const [submitting, setSubmitting] = useState(false);
  const [logged, setLogged] = useState<{ plazaName: string; amount: string }[]>([]);

  async function logToll() {
    if (!plazaName || !amountPaid) { Alert.alert('Required', 'Plaza name and amount are required'); return; }
    setSubmitting(true);
    try {
      await apiClient.post('/truckers/my/journey/toll', {
        loadId, journeyLogId, plazaName, highwayCode, stateName,
        amountPaid: parseFloat(amountPaid), paymentMethod,
      });
      setLogged(prev => [...prev, { plazaName, amount: amountPaid }]);
      setPlazaName(''); setHighwayCode(''); setStateName(''); setAmountPaid('');
      Alert.alert('Logged', `₹${amountPaid} toll at ${plazaName} recorded.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Log Toll</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Plaza Name *</Text>
        <TextInput value={plazaName} onChangeText={setPlazaName} style={styles.input} placeholder="e.g. Hoskote Toll Plaza" />
        <Text style={styles.label}>Highway Code</Text>
        <TextInput value={highwayCode} onChangeText={setHighwayCode} style={styles.input} placeholder="e.g. NH-44" />
        <Text style={styles.label}>State</Text>
        <TextInput value={stateName} onChangeText={setStateName} style={styles.input} placeholder="e.g. Karnataka" />
        <Text style={styles.label}>Amount Paid (₹) *</Text>
        <TextInput value={amountPaid} onChangeText={setAmountPaid} style={styles.input} placeholder="e.g. 195" keyboardType="decimal-pad" />
        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.methodRow}>
          {['fastag', 'cash', 'upi'].map(m => (
            <TouchableOpacity key={m} style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]} onPress={() => setPaymentMethod(m)}>
              <Text style={[styles.methodBtnText, paymentMethod === m && styles.methodBtnTextActive]}>{m.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={logToll} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? 'Logging…' : 'Log Toll'}</Text>
        </TouchableOpacity>
      </View>

      {logged.length > 0 && (
        <View style={styles.loggedSection}>
          <Text style={styles.loggedTitle}>Logged This Journey</Text>
          {logged.map((l, i) => (
            <View key={i} style={styles.loggedItem}>
              <Text style={styles.loggedPlaza}>{l.plazaName}</Text>
              <Text style={styles.loggedAmount}>₹{l.amount}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 20 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827' },
  methodRow: { flexDirection: 'row', gap: 10 },
  methodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  methodBtnActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  methodBtnText: { fontWeight: '600', color: '#6B7280', fontSize: 13 },
  methodBtnTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#F97316', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  loggedSection: { marginTop: 20 },
  loggedTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 10 },
  loggedItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  loggedPlaza: { fontWeight: '500', color: '#111827' },
  loggedAmount: { fontWeight: '700', color: '#059669' },
});
