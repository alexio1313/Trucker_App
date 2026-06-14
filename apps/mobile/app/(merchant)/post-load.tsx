import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loadsApi } from '@truck-platform/api-client';
import { colors, fontSize, spacing, borderRadius } from '@truck-platform/ui-kit';

type CargoType = 'general' | 'fragile' | 'hazmat' | 'temperature_controlled' | 'liquid' | 'oversized';

const CARGO_TYPES: CargoType[] = ['general', 'fragile', 'hazmat', 'temperature_controlled', 'liquid', 'oversized'];

export default function PostLoadScreen() {
  const queryClient = useQueryClient();

  // Origin
  const [originAddress, setOriginAddress] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [originLat, setOriginLat] = useState('');
  const [originLng, setOriginLng] = useState('');

  // Destination
  const [destAddress, setDestAddress] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');

  // Cargo
  const [weightKg, setWeightKg] = useState('');
  const [cargoType, setCargoType] = useState<CargoType>('general');
  const [specialReq, setSpecialReq] = useState('');

  // Time
  const [pickupStart, setPickupStart] = useState('');
  const [pickupEnd, setPickupEnd] = useState('');
  const [deliveryExpected, setDeliveryExpected] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      loadsApi.createLoad({
        origin: {
          lat: parseFloat(originLat), lng: parseFloat(originLng),
          address: originAddress, city: originCity, state: originState,
        },
        destination: {
          lat: parseFloat(destLat), lng: parseFloat(destLng),
          address: destAddress, city: destCity, state: destState,
        },
        cargo: {
          weightKg: parseFloat(weightKg),
          cargoType,
          specialRequirements: specialReq || undefined,
        },
        timeWindow: {
          pickupStart: new Date(pickupStart).toISOString(),
          pickupEnd: new Date(pickupEnd).toISOString(),
          deliveryExpected: new Date(deliveryExpected).toISOString(),
          loadingTimeMinutes: 30,
          unloadingTimeMinutes: 30,
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['merchant-loads'] });
      Alert.alert('Load Posted!', `Load ID: ${data.data.loadId}`, [
        { text: 'View My Loads', onPress: () => router.push('/(merchant)/my-loads') },
      ]);
    },
    onError: (err: unknown) => {
      const msg = (err as { error?: { message?: string } })?.error?.message ?? 'Failed to post load';
      Alert.alert('Error', msg);
    },
  });

  function validate(): boolean {
    if (!originCity || !destCity || !weightKg || !pickupStart || !deliveryExpected) {
      Alert.alert('Missing fields', 'Please fill all required fields');
      return false;
    }
    if (parseFloat(weightKg) <= 0) {
      Alert.alert('Invalid weight', 'Weight must be greater than 0');
      return false;
    }
    return true;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Post a Load</Text>

      <Text style={styles.sectionTitle}>Origin</Text>
      <TextInput style={styles.input} placeholder="Full address *" value={originAddress} onChangeText={setOriginAddress} />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex]} placeholder="City *" value={originCity} onChangeText={setOriginCity} />
        <TextInput style={[styles.input, styles.flex]} placeholder="State *" value={originState} onChangeText={setOriginState} />
      </View>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex]} placeholder="Latitude" value={originLat} onChangeText={setOriginLat} keyboardType="numeric" />
        <TextInput style={[styles.input, styles.flex]} placeholder="Longitude" value={originLng} onChangeText={setOriginLng} keyboardType="numeric" />
      </View>

      <Text style={styles.sectionTitle}>Destination</Text>
      <TextInput style={styles.input} placeholder="Full address *" value={destAddress} onChangeText={setDestAddress} />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex]} placeholder="City *" value={destCity} onChangeText={setDestCity} />
        <TextInput style={[styles.input, styles.flex]} placeholder="State *" value={destState} onChangeText={setDestState} />
      </View>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex]} placeholder="Latitude" value={destLat} onChangeText={setDestLat} keyboardType="numeric" />
        <TextInput style={[styles.input, styles.flex]} placeholder="Longitude" value={destLng} onChangeText={setDestLng} keyboardType="numeric" />
      </View>

      <Text style={styles.sectionTitle}>Cargo Details</Text>
      <TextInput style={styles.input} placeholder="Weight (kg) *" value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" />

      <Text style={styles.label}>Cargo Type *</Text>
      <View style={styles.chipRow}>
        {CARGO_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, cargoType === t && styles.chipActive]}
            onPress={() => setCargoType(t)}
          >
            <Text style={[styles.chipText, cargoType === t && styles.chipTextActive]}>
              {t.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput style={[styles.input, styles.textarea]} placeholder="Special requirements (optional)" value={specialReq} onChangeText={setSpecialReq} multiline />

      <Text style={styles.sectionTitle}>Schedule</Text>
      <TextInput style={styles.input} placeholder="Pickup start (YYYY-MM-DD HH:MM) *" value={pickupStart} onChangeText={setPickupStart} />
      <TextInput style={styles.input} placeholder="Pickup deadline (YYYY-MM-DD HH:MM) *" value={pickupEnd} onChangeText={setPickupEnd} />
      <TextInput style={styles.input} placeholder="Expected delivery (YYYY-MM-DD HH:MM) *" value={deliveryExpected} onChangeText={setDeliveryExpected} />

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={() => { if (validate()) createMutation.mutate(); }}
        disabled={createMutation.isPending}
      >
        {createMutation.isPending
          ? <ActivityIndicator color={colors.textInverse} />
          : <Text style={styles.submitBtnText}>Post Load</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: spacing[4] },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[4], paddingTop: spacing[8] },
  sectionTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.secondary, marginTop: spacing[4], marginBottom: spacing[2] },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing[2] },
  input: { borderWidth: 1, borderColor: colors.gray200, borderRadius: borderRadius.md, padding: spacing[3], fontSize: fontSize.base, marginBottom: spacing[3], backgroundColor: colors.bgPrimary },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing[2] },
  flex: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray300 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  chipTextActive: { color: colors.textInverse, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: spacing[4], borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[8] },
  submitBtnText: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: '700' },
});
