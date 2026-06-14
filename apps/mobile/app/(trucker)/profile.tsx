import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, Switch } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { truckersApi, authApi } from '@truck-platform/api-client';
import { useAuthStore } from '@truck-platform/state';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  const { data: profileData } = useQuery({
    queryKey: ['trucker-profile'],
    queryFn: () => truckersApi.getProfile(),
  });

  const { data: trucksData } = useQuery({
    queryKey: ['trucks'],
    queryFn: () => truckersApi.getTrucks(),
  });

  const availabilityMutation = useMutation({
    mutationFn: (available: boolean) =>
      truckersApi.updateAvailability(available ? 'available' : 'offline'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trucker-profile'] }),
  });

  const profile = profileData?.data;
  const trucks = trucksData?.data ?? [];
  const isAvailable = profile?.isAvailable ?? false;

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.fullName?.charAt(0) ?? 'T'}</Text>
        </View>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.phone}>{user?.phoneNumber}</Text>
        <View style={[styles.kycBadge, profile?.kycStatus === 'approved' ? styles.kycApproved : styles.kycPending]}>
          <Text style={styles.kycText}>
            KYC: {profile?.kycStatus === 'approved' ? 'Verified' : profile?.kycStatus ?? 'Pending'}
          </Text>
        </View>
      </View>

      {/* Availability toggle */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.cardLabel}>Available for Loads</Text>
            <Text style={styles.cardSub}>Toggle to show up in load searches</Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={(v) => availabilityMutation.mutate(v)}
            trackColor={{ true: '#FF6B00', false: '#D1D5DB' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.completedLoads ?? 0}</Text>
          <Text style={styles.statLabel}>Deliveries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.rating?.toFixed(1) ?? '—'}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{trucks.length}</Text>
          <Text style={styles.statLabel}>Trucks</Text>
        </View>
      </View>

      {/* My Trucks */}
      {trucks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Trucks</Text>
          {trucks.map((truck) => (
            <View key={truck.truckId} style={styles.truckCard}>
              <Text style={styles.truckReg}>{truck.registrationNumber}</Text>
              <Text style={styles.truckType}>{truck.truckType} · {truck.capacityKg}kg</Text>
              <View style={[styles.truckStatus, truck.isActive ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.truckStatusText}>{truck.isActive ? 'Active' : 'Inactive'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/kyc')}>
          <Text style={styles.menuLabel}>KYC Documents</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/bank-details')}>
          <Text style={styles.menuLabel}>Bank Account</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/add-truck')}>
          <Text style={styles.menuLabel}>Add Truck</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#1A1A2E', alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF6B00', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  name: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  phone: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  kycBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  kycApproved: { backgroundColor: '#022C22' },
  kycPending: { backgroundColor: '#431407' },
  kycText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statsGrid: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#FF6B00' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  truckCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  truckReg: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  truckType: { fontSize: 13, color: '#6B7280', marginRight: 8 },
  truckStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#F3F4F6' },
  truckStatusText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  menuItem: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  menuLabel: { fontSize: 15, color: '#111827' },
  menuChevron: { fontSize: 20, color: '#9CA3AF' },
  logoutBtn: { marginHorizontal: 16, marginTop: 24, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5', alignItems: 'center' },
  logoutText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
});
