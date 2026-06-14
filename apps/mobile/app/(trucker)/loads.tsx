import { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadsApi } from '@truck-platform/api-client';
import { Load } from '@truck-platform/shared';
import { colors, fontSize, spacing, borderRadius, shadow } from '@truck-platform/ui-kit';
import { formatCurrency, formatDistance, formatWeight } from '@truck-platform/shared';

function LoadCard({ load, onAccept }: { load: Load; onAccept: (id: string) => void }) {
  const originCity = load.origin?.city ?? '';
  const destCity = load.destination?.city ?? '';
  const price = load.pricing?.agreedPrice ?? load.pricing?.aiSuggestedPrice ?? 0;
  const weightKg = load.cargo?.weightKg ?? 0;
  const cargoType = load.cargo?.cargoType ?? '';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.routeContainer}>
          <Text style={styles.city}>{originCity}</Text>
          <Text style={styles.arrow}>→</Text>
          <Text style={styles.city}>{destCity}</Text>
        </View>
        <Text style={styles.price}>{formatCurrency(price)}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.info}>{formatDistance(load.distanceKm ?? 0)}</Text>
        <Text style={styles.info}>{formatWeight(weightKg)}</Text>
        <Text style={styles.info}>{cargoType}</Text>
        <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
          <Text style={[styles.badgeText, { color: colors.success }]}>New</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.merchantName}>{originCity} → {destCity}</Text>
        </View>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => onAccept(load.loadId)}
        >
          <Text style={styles.acceptBtnText}>Accept Load</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LoadsDiscoveryScreen() {
  const [originCity, setOriginCity] = useState('');
  const [destCity, setDestCity] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['loads-search', originCity, destCity],
    queryFn: () => loadsApi.searchLoads({ originCity: originCity || undefined, destinationCity: destCity || undefined, pageSize: 20 }),
    staleTime: 60000,
  });

  const acceptMutation = useMutation({
    mutationFn: (loadId: string) => loadsApi.acceptLoad(loadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loads-search'] });
      queryClient.invalidateQueries({ queryKey: ['active-load'] });
      Alert.alert('Load Accepted!', 'Navigate to the pickup location to begin.');
    },
    onError: (err: unknown) => {
      const message = (err as { error?: { message?: string } })?.error?.message ?? 'Failed to accept load';
      Alert.alert('Error', message);
    },
  });

  const loads = (data?.data?.items ?? []) as unknown as Load[];

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Origin city"
          value={originCity}
          onChangeText={setOriginCity}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Destination city"
          value={destCity}
          onChangeText={setDestCity}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => refetch()}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing[8] }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={loads}
          keyExtractor={(l) => l.loadId}
          renderItem={({ item }) => (
            <LoadCard
              load={item}
              onAccept={(id) => {
                Alert.alert('Confirm', 'Accept this load?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Accept', onPress: () => acceptMutation.mutate(id) },
                ]);
              }}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No loads found. Try adjusting your search.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  searchBar: { flexDirection: 'row', gap: spacing[2], padding: spacing[4], backgroundColor: colors.bgPrimary },
  searchInput: { flex: 1, padding: spacing[2], borderWidth: 1, borderColor: colors.gray200, borderRadius: borderRadius.md, fontSize: fontSize.sm },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing[3], borderRadius: borderRadius.md, justifyContent: 'center' },
  searchBtnText: { color: colors.textInverse, fontWeight: '600', fontSize: fontSize.sm },
  list: { padding: spacing[4], gap: spacing[3] },
  card: { backgroundColor: colors.bgCard, borderRadius: borderRadius.xl, padding: spacing[4], ...shadow.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  routeContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  city: { fontSize: fontSize.base, fontWeight: '600', color: colors.textPrimary },
  arrow: { color: colors.textSecondary },
  price: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  infoRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap', marginBottom: spacing[2] },
  info: { fontSize: fontSize.xs, color: colors.textSecondary },
  badge: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: borderRadius.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: '600' },
  aiHint: { fontSize: fontSize.xs, color: colors.info, marginBottom: spacing[3], fontStyle: 'italic' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[2] },
  merchantName: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
  merchantRating: { fontSize: fontSize.xs, color: colors.textSecondary },
  acceptBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: borderRadius.lg },
  acceptBtnText: { color: colors.textInverse, fontWeight: '600', fontSize: fontSize.sm },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing[8] },
});
