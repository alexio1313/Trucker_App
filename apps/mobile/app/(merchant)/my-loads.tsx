import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { loadsApi } from '@truck-platform/api-client';
import { LoadStatus } from '@truck-platform/shared';
import { formatCurrency, formatRelativeTime } from '@truck-platform/shared';

const FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Posted', value: 'posted' },
  { label: 'Active', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  posted: { bg: '#FEF9C3', text: '#713F12' },
  accepted: { bg: '#DBEAFE', text: '#1E3A5F' },
  loading: { bg: '#EDE9FE', text: '#3730A3' },
  in_transit: { bg: '#FFEDD5', text: '#7C2D12' },
  delivered: { bg: '#DCFCE7', text: '#14532D' },
  cancelled: { bg: '#F3F4F6', text: '#374151' },
  disputed: { bg: '#FEE2E2', text: '#7F1D1D' },
};

export default function MyLoadsScreen() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetchingNextPage } = useQuery({
    queryKey: ['merchant-loads-list', statusFilter, page],
    queryFn: () => loadsApi.getMerchantLoads({ status: statusFilter || undefined, page, pageSize: 20 }),
  });

  const loads = data?.data?.items ?? [];
  const pagination = data?.data?.pagination;

  function renderItem({ item: load }: { item: (typeof loads)[0] }) {
    const colors = STATUS_COLORS[load.status] ?? { bg: '#F3F4F6', text: '#374151' };
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/merchant/load/${load.loadId}`)}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.route}>{load.origin.city} → {load.destination.city}</Text>
            <Text style={styles.meta}>{load.loadId}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {load.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.cargo}>{load.cargo.weightKg}kg · {load.cargo.cargoType}</Text>
          <View style={styles.rightMeta}>
            <Text style={styles.price}>{formatCurrency(load.pricing.agreedPrice ?? 0)}</Text>
            <Text style={styles.time}>{formatRelativeTime(new Date(load.createdAt))}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.value}
          contentContainerStyle={styles.filters}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
              onPress={() => { setStatusFilter(f.value); setPage(1); }}
            >
              <Text style={[styles.filterText, statusFilter === f.value && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#FF6B00" size="large" />
        </View>
      ) : (
        <FlatList
          data={loads}
          keyExtractor={(l) => l.loadId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>No loads found</Text>
            </View>
          }
          ListFooterComponent={
            pagination && pagination.totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, !pagination.hasPrevPage && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevPage}
                >
                  <Text style={styles.pageBtnText}>← Prev</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {pagination.page} / {pagination.totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, !pagination.hasNextPage && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  <Text style={styles.pageBtnText}>Next →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  filterBar: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filters: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#FF6B00' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, gap: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1 },
  route: { fontSize: 15, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 11, fontFamily: 'monospace', color: '#9CA3AF', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cargo: { fontSize: 13, color: '#6B7280' },
  rightMeta: { alignItems: 'flex-end' },
  price: { fontSize: 14, fontWeight: '700', color: '#111827' },
  time: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  pageInfo: { fontSize: 13, color: '#6B7280' },
});
