import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiClient } from '../../src/lib/api';

interface BreakSuggestion {
  type: string;
  priority: number;
  reason: string;
  complianceRule?: string;
}

interface AdCard {
  id: string;
  title: string;
  offerText: string;
  businessName: string;
  distanceKm: number;
  phone: string;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F59E0B',
  3: '#3B82F6',
  4: '#6B7280',
};

const BREAK_ICONS: Record<string, string> = {
  rest: '😴',
  fuel: '⛽',
  meal: '🍛',
  washroom: '🚻',
};

export default function BreaksScreen() {
  const { journeyLogId } = useLocalSearchParams<{ journeyLogId: string }>();
  const [suggestions, setSuggestions] = useState<BreakSuggestion[]>([]);
  const [activeBreak, setActiveBreak] = useState<{ id: string; type: string; startedAt: string } | null>(null);
  const [elapsedMins, setElapsedMins] = useState(0);
  const [contextualAds, setContextualAds] = useState<AdCard[]>([]);

  useEffect(() => {
    if (journeyLogId) {
      fetchSuggestions();
    }
  }, [journeyLogId]);

  useEffect(() => {
    if (!activeBreak) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(activeBreak.startedAt).getTime()) / 60000);
      setElapsedMins(elapsed);
    }, 60000);
    return () => clearInterval(interval);
  }, [activeBreak]);

  async function fetchSuggestions() {
    try {
      const data = await apiClient.get(`/truckers/my/journey/break-suggestions?journeyLogId=${journeyLogId}`);
      setSuggestions(data.data || []);
    } catch {}
  }

  async function startBreak(type: string) {
    try {
      const data = await apiClient.post('/truckers/my/journey/break-start', { journeyLogId, breakType: type });
      setActiveBreak({ id: data.data.id, type, startedAt: data.data.startedAt });
      // Fetch contextual ads
      fetchAds(type);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function endBreak() {
    if (!activeBreak) return;
    try {
      await apiClient.post('/truckers/my/journey/break-end', { breakId: activeBreak.id, journeyLogId });
      setActiveBreak(null);
      setContextualAds([]);
      fetchSuggestions();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function fetchAds(breakType: string) {
    try {
      const data = await apiClient.post('/highway/ads/serve', { breakType, driverLat: 12.97, driverLng: 77.59, driverId: 'self' });
      setContextualAds(data.data || []);
    } catch {}
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Breaks</Text>

      {activeBreak ? (
        <View style={styles.activeBreakCard}>
          <Text style={styles.activeBreakIcon}>{BREAK_ICONS[activeBreak.type] || '☕'}</Text>
          <Text style={styles.activeBreakTitle}>{activeBreak.type.charAt(0).toUpperCase() + activeBreak.type.slice(1)} Break</Text>
          <Text style={styles.activeBreakTime}>{elapsedMins} min elapsed</Text>
          <TouchableOpacity style={styles.endBreakBtn} onPress={endBreak}>
            <Text style={styles.endBreakBtnText}>End Break</Text>
          </TouchableOpacity>

          {contextualAds.length > 0 && (
            <View style={styles.adsSection}>
              <Text style={styles.adsSectionTitle}>Nearby businesses</Text>
              {contextualAds.map(ad => (
                <View key={ad.id} style={styles.adCard}>
                  <Text style={styles.adTitle}>{ad.title}</Text>
                  <Text style={styles.adBusiness}>{ad.businessName} · {ad.distanceKm.toFixed(1)}km away</Text>
                  {ad.offerText && <Text style={styles.adOffer}>{ad.offerText}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <>
          {suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <Text style={styles.sectionTitle}>Suggestions</Text>
              {suggestions.map((s, i) => (
                <View key={i} style={[styles.suggestionCard, { borderLeftColor: PRIORITY_COLORS[s.priority] || '#3B82F6' }]}>
                  <View style={styles.suggestionRow}>
                    <Text style={styles.suggestionIcon}>{BREAK_ICONS[s.type] || '⏸️'}</Text>
                    <View style={styles.suggestionContent}>
                      <Text style={styles.suggestionType}>{s.type.charAt(0).toUpperCase() + s.type.slice(1)} break recommended</Text>
                      <Text style={styles.suggestionReason}>{s.reason}</Text>
                    </View>
                    <TouchableOpacity style={[styles.startBtn, { backgroundColor: PRIORITY_COLORS[s.priority] || '#3B82F6' }]} onPress={() => startBreak(s.type)}>
                      <Text style={styles.startBtnText}>Start</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Log a break</Text>
          <View style={styles.breakGrid}>
            {Object.entries(BREAK_ICONS).map(([type, icon]) => (
              <TouchableOpacity key={type} style={styles.breakTypeBtn} onPress={() => startBreak(type)}>
                <Text style={styles.breakTypeIcon}>{icon}</Text>
                <Text style={styles.breakTypeLabel}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
  activeBreakCard: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#FDBA74' },
  activeBreakIcon: { fontSize: 48, marginBottom: 8 },
  activeBreakTitle: { fontSize: 20, fontWeight: '700', color: '#92400E' },
  activeBreakTime: { fontSize: 16, color: '#B45309', marginBottom: 16 },
  endBreakBtn: { backgroundColor: '#F97316', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  endBreakBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  adsSection: { width: '100%', marginTop: 20 },
  adsSectionTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  adCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A' },
  adTitle: { fontWeight: '600', color: '#111827' },
  adBusiness: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  adOffer: { fontSize: 12, color: '#059669', marginTop: 4, fontWeight: '500' },
  suggestionsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  suggestionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionIcon: { fontSize: 24 },
  suggestionContent: { flex: 1 },
  suggestionType: { fontWeight: '600', color: '#111827' },
  suggestionReason: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  startBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  startBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  breakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  breakTypeBtn: { width: '46%', backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  breakTypeIcon: { fontSize: 32, marginBottom: 6 },
  breakTypeLabel: { fontWeight: '600', color: '#374151' },
});
