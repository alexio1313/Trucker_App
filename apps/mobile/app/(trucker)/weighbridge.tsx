import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiClient } from '../../src/lib/api';

export default function WeighbridgeScreen() {
  const { loadId, journeyLogId } = useLocalSearchParams<{ loadId: string; journeyLogId: string }>();
  const [locationName, setLocationName] = useState('');
  const [weightRecorded, setWeightRecorded] = useState('');
  const [gvwLimit, setGvwLimit] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function logWeighbridge() {
    if (!locationName) { Alert.alert('Required', 'Location name is required'); return; }
    setSubmitting(true);
    try {
      const resp = await apiClient.post('/truckers/my/journey/weighbridge', {
        loadId, journeyLogId, locationName,
        weightRecordedTonnes: parseFloat(weightRecorded || '0'),
        gvwLimitTonnes: parseFloat(gvwLimit || '0'),
        fineAmount: parseFloat(fineAmount || '0'),
        notes,
      });
      const status = resp.data?.status;
      const msg = status === 'overloaded' ? '⚠️ Overloaded!' : status === 'fined' ? `⚠️ Fine: ₹${fineAmount}` : '✅ Pass';
      Alert.alert('Logged', `Weighbridge stop recorded. ${msg}`);
      setLocationName(''); setWeightRecorded(''); setGvwLimit(''); setFineAmount(''); setNotes('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⚖️ Weighbridge Stop</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Location Name *</Text>
        <TextInput value={locationName} onChangeText={setLocationName} style={styles.input} placeholder="e.g. Tumkur Weighbridge" />
        <Text style={styles.label}>Weight Recorded (tonnes)</Text>
        <TextInput value={weightRecorded} onChangeText={setWeightRecorded} style={styles.input} placeholder="e.g. 18.5" keyboardType="decimal-pad" />
        <Text style={styles.label}>GVW Limit (tonnes)</Text>
        <TextInput value={gvwLimit} onChangeText={setGvwLimit} style={styles.input} placeholder="e.g. 20.0" keyboardType="decimal-pad" />
        <Text style={styles.label}>Fine Amount (₹) — if any</Text>
        <TextInput value={fineAmount} onChangeText={setFineAmount} style={styles.input} placeholder="0" keyboardType="decimal-pad" />
        <Text style={styles.label}>Notes</Text>
        <TextInput value={notes} onChangeText={setNotes} style={[styles.input, { height: 80 }]} placeholder="Any additional notes" multiline />
        <TouchableOpacity style={styles.submitBtn} onPress={logWeighbridge} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? 'Logging…' : 'Log Stop'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 20 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827' },
  submitBtn: { backgroundColor: '#F97316', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
