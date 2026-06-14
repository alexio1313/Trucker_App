import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { truckersApi } from '@truck-platform/api-client';
import { colors, fontSize, spacing, borderRadius, shadow } from '@truck-platform/ui-kit';
import { formatCurrency, formatRelativeTime } from '@truck-platform/shared';

type Period = 'daily' | 'weekly' | 'monthly';

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>('weekly');

  const { data: earningsData } = useQuery({
    queryKey: ['earnings', period],
    queryFn: () => truckersApi.getEarningsSummary(period),
  });

  const { data: historyData } = useQuery({
    queryKey: ['load-history'],
    queryFn: () => truckersApi.getLoadHistory({ pageSize: 10, status: 'delivered' }),
  });

  const earnings = earningsData?.data;
  const loads = historyData?.data?.items ?? [];

  return (
    <ScrollView style={styles.container}>
      {/* Period Selector */}
      <View style={styles.periodRow}>
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Earnings Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Net Earnings</Text>
        <Text style={styles.summaryValue}>{formatCurrency(earnings?.netPayout ?? 0)}</Text>
        <View style={styles.summaryDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Gross</Text>
            <Text style={styles.detailValue}>{formatCurrency(earnings?.grossEarnings ?? 0)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Commission</Text>
            <Text style={[styles.detailValue, { color: colors.danger }]}>
              -{formatCurrency(earnings?.platformCommission ?? 0)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Loads</Text>
            <Text style={styles.detailValue}>{earnings?.loadsCount ?? 0}</Text>
          </View>
        </View>
        {earnings?.nextSettlementDate && (
          <Text style={styles.settlementText}>
            Next payout: {new Date(earnings.nextSettlementDate).toLocaleDateString('en-IN')}
          </Text>
        )}
      </View>

      {/* Recent Loads */}
      <Text style={styles.sectionTitle}>Recent Deliveries</Text>
      {loads.map((load) => (
        <View key={load.loadId} style={styles.loadRow}>
          <View style={styles.loadInfo}>
            <Text style={styles.loadRoute}>{load.origin.city} → {load.destination.city}</Text>
            <Text style={styles.loadDate}>{formatRelativeTime(new Date(load.createdAt))}</Text>
          </View>
          <Text style={styles.loadEarning}>
            {formatCurrency(load.pricing.netTruckerEarning ?? 0)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  periodRow: { flexDirection: 'row', padding: spacing[4], gap: spacing[2] },
  periodBtn: { flex: 1, paddingVertical: spacing[2], borderRadius: borderRadius.full, backgroundColor: colors.gray100, alignItems: 'center' },
  periodBtnActive: { backgroundColor: colors.primary },
  periodBtnText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textSecondary },
  periodBtnTextActive: { color: colors.textInverse },
  summaryCard: { margin: spacing[4], backgroundColor: colors.secondary, borderRadius: borderRadius.xl, padding: spacing[5], ...shadow.md },
  summaryLabel: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)' },
  summaryValue: { fontSize: fontSize['3xl'], fontWeight: '700', color: colors.textInverse, marginVertical: spacing[2] },
  summaryDetails: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: spacing[3] },
  detailItem: { alignItems: 'center' },
  detailLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.6)' },
  detailValue: { fontSize: fontSize.base, fontWeight: '600', color: colors.textInverse, marginTop: spacing[1] },
  settlementText: { fontSize: fontSize.xs, color: colors.accent, marginTop: spacing[3] },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  loadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bgCard, marginHorizontal: spacing[4], marginBottom: spacing[2], padding: spacing[4], borderRadius: borderRadius.lg, ...shadow.sm },
  loadInfo: { flex: 1 },
  loadRoute: { fontSize: fontSize.base, fontWeight: '500', color: colors.textPrimary },
  loadDate: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing[1] },
  loadEarning: { fontSize: fontSize.md, fontWeight: '700', color: colors.success },
});
