import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { truckersApi } from '@truck-platform/api-client';
import { useAuthStore } from '@truck-platform/state';
import { colors, fontSize, spacing, borderRadius, shadow } from '@truck-platform/ui-kit';
import { formatCurrency } from '@truck-platform/shared';

export default function TruckerDashboard() {
  const user = useAuthStore((s) => s.user);

  const { data: profileData } = useQuery({
    queryKey: ['trucker-profile'],
    queryFn: () => truckersApi.getProfile(),
  });

  const { data: earningsData } = useQuery({
    queryKey: ['earnings-daily'],
    queryFn: () => truckersApi.getEarningsSummary('daily'),
  });

  const { data: activeLoadData, refetch, isRefetching } = useQuery({
    queryKey: ['active-load'],
    queryFn: () => truckersApi.getLoadHistory({ status: 'in_transit', pageSize: 1 }),
    refetchInterval: 30000,
  });

  const profile = profileData?.data;
  const earnings = earningsData?.data;
  const activeLoad = activeLoadData?.data?.items?.[0];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.name}>{user?.fullName?.split(' ')[0]}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>⭐ {user?.rating?.toFixed(1)}</Text>
        </View>
      </View>

      {/* Active Load Banner */}
      {activeLoad && (
        <TouchableOpacity
          style={styles.activeLoadCard}
          onPress={() => router.push(`/(trucker)/tracking`)}
        >
          <Text style={styles.activeLoadLabel}>ACTIVE LOAD</Text>
          <Text style={styles.activeLoadRoute}>
            {activeLoad.origin.city} → {activeLoad.destination.city}
          </Text>
          <Text style={styles.activeLoadStatus}>In Transit • Tap to track</Text>
        </TouchableOpacity>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.totalLoadsCompleted ?? 0}</Text>
          <Text style={styles.statLabel}>Loads Done</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(earnings?.netPayout ?? 0)}</Text>
          <Text style={styles.statLabel}>Today's Earning</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.rating?.toFixed(1) ?? '–'}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(trucker)/loads')}>
          <Text style={styles.actionIcon}>🔍</Text>
          <Text style={styles.actionText}>Find Loads</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(trucker)/earnings')}>
          <Text style={styles.actionIcon}>💰</Text>
          <Text style={styles.actionText}>My Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(trucker)/profile')}>
          <Text style={styles.actionIcon}>🚛</Text>
          <Text style={styles.actionText}>My Trucks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>📞</Text>
          <Text style={styles.actionText}>Support</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[5], paddingTop: spacing[12], backgroundColor: colors.secondary },
  greeting: { fontSize: fontSize.sm, color: colors.gray400 },
  name: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textInverse },
  ratingBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: borderRadius.full },
  ratingText: { color: colors.textInverse, fontWeight: '600', fontSize: fontSize.sm },
  activeLoadCard: { margin: spacing[4], backgroundColor: colors.primary, borderRadius: borderRadius.xl, padding: spacing[4] },
  activeLoadLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 1 },
  activeLoadRoute: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textInverse, marginTop: spacing[1] },
  activeLoadStatus: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: spacing[1] },
  statsRow: { flexDirection: 'row', gap: spacing[3], padding: spacing[4] },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: borderRadius.lg, padding: spacing[4], alignItems: 'center', ...shadow.md },
  statValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing[1] },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, paddingHorizontal: spacing[4], marginBottom: spacing[3] },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing[4], gap: spacing[3] },
  actionBtn: { width: '47%', backgroundColor: colors.bgCard, borderRadius: borderRadius.xl, padding: spacing[4], alignItems: 'center', ...shadow.sm },
  actionIcon: { fontSize: 28, marginBottom: spacing[2] },
  actionText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
});
