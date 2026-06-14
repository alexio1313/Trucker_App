import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { loadsApi } from '@truck-platform/api-client';
import { useAuthStore } from '@truck-platform/state';
import { formatCurrency, formatRelativeTime } from '@truck-platform/shared';
import { LoadStatus } from '@truck-platform/shared';

const STATUS_COLORS: Record<LoadStatus, { bg: string; text: string }> = {
  posted: { bg: '#FEF9C3', text: '#713F12' },
  accepted: { bg: '#DBEAFE', text: '#1E3A5F' },
  loading: { bg: '#EDE9FE', text: '#3730A3' },
  in_transit: { bg: '#FFEDD5', text: '#7C2D12' },
  delivered: { bg: '#DCFCE7', text: '#14532D' },
  cancelled: { bg: '#F3F4F6', text: '#374151' },
  disputed: { bg: '#FEE2E2', text: '#7F1D1D' },
};

function StatCard({ label, value, color = '#111827' }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function MerchantDashboardScreen() {
  const user = useAuthStore((s) => s.user);

  const { data: loadsData, isLoading, refetch } = useQuery({
    queryKey: ['merchant-loads-mobile'],
    queryFn: () => loadsApi.getMerchantLoads({ pageSize: 10 }),
    refetchInterval: 60000,
  });

  const { data: activeData } = useQuery({
    queryKey: ['merchant-active-mobile'],
    queryFn: () => loadsApi.getMerchantLoads({ status: 'in_transit' }),
    refetchInterval: 30000,
  });

  const loads = loadsData?.data?.items ?? [];
  const activeLoads = activeData?.data?.items ?? [];
  const totalLoads = loadsData?.data?.pagination?.total ?? 0;
  const totalSpend = loads.reduce((sum, l) => sum + (l.pricing.agreedPrice ?? 0), 0);
  const deliveredCount = loads.filter((l) => l.status === 'delivered').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#FF6B00" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.fullName?.split(' ')[0]}</Text>
          <Text style={styles.subGreeting}>Your freight overview</Text>
        </View>
        <TouchableOpacity style={styles.postBtn} onPress={() => router.push('/merchant/post-load')}>
          <Text style={styles.postBtnText}>+ Post Load</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Total Loads" value={String(totalLoads)} />
        <StatCard label="Active" value={String(activeLoads.length)} color="#FF6B00" />
        <StatCard label="Delivered" value={String(deliveredCount)} color="#22C55E" />
        <StatCard label="Spent" value={`₹${(totalSpend / 1000).toFixed(0)}K`} />
      </View>

      {/* Active loads */}
      {activeLoads.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Loads</Text>
          {activeLoads.map((load) => (
            <TouchableOpacity
              key={load.loadId}
              style={styles.activeCard}
              onPress={() => router.push(`/merchant/load/${load.loadId}`)}
            >
              <View style={styles.activeCardContent}>
                <Text style={styles.activeRoute}>{load.origin.city} → {load.destination.city}</Text>
                <Text style={styles.activeId}>{load.loadId}</Text>
              </View>
              <View style={styles.inTransitBadge}>
                <Text style={styles.inTransitText}>In Transit</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent loads */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Loads</Text>
          <TouchableOpacity onPress={() => router.push('/merchant/my-loads')}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {loads.map((load) => {
          const colors = STATUS_COLORS[load.status] ?? { bg: '#F3F4F6', text: '#374151' };
          return (
            <TouchableOpacity
              key={load.loadId}
              style={styles.loadCard}
              onPress={() => router.push(`/merchant/load/${load.loadId}`)}
            >
              <View style={styles.loadCardLeft}>
                <Text style={styles.loadRoute}>{load.origin.city} → {load.destination.city}</Text>
                <Text style={styles.loadMeta}>{formatRelativeTime(new Date(load.createdAt))} · {load.cargo.weightKg}kg</Text>
              </View>
              <View style={styles.loadCardRight}>
                <Text style={styles.loadPrice}>{formatCurrency(load.pricing.agreedPrice ?? 0)}</Text>
                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>{load.status.replace('_', ' ')}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        {loads.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>No loads yet</Text>
            <TouchableOpacity onPress={() => router.push('/merchant/post-load')}>
              <Text style={styles.emptyLink}>Post your first load →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: '#1A1A2E' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  subGreeting: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
  postBtn: { backgroundColor: '#FF6B00', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  postBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', padding: 16, gap: 8 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  viewAll: { fontSize: 13, color: '#FF6B00', fontWeight: '600' },
  activeCard: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeCardContent: { flex: 1 },
  activeRoute: { fontSize: 14, fontWeight: '600', color: '#111827' },
  activeId: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  inTransitBadge: { backgroundColor: '#FF6B00', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  inTransitText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  loadCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  loadCardLeft: { flex: 1 },
  loadRoute: { fontSize: 14, fontWeight: '600', color: '#111827' },
  loadMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  loadCardRight: { alignItems: 'flex-end' },
  loadPrice: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginBottom: 8 },
  emptyLink: { fontSize: 14, color: '#FF6B00', fontWeight: '600' },
});
