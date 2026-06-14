import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@truck-platform/state';
import { authApi } from '@truck-platform/api-client';
import { colors, fontSize, spacing, borderRadius } from '@truck-platform/ui-kit';

type UserType = 'trucker' | 'merchant';

export default function RegisterScreen() {
  const [userType, setUserType] = useState<UserType>('trucker');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { setTokens } = useAuthStore();

  async function handleRegister() {
    if (!fullName || !phone || !password) {
      Alert.alert('Missing fields', 'Name, phone, and password are required');
      return;
    }
    const normalized = phone.startsWith('+91') ? phone : `+91${phone}`;

    setIsLoading(true);
    try {
      const result = await authApi.register({
        userType,
        fullName,
        phoneNumber: normalized,
        email: email || undefined,
        password,
        gstNumber: gstNumber || undefined,
      });
      setTokens(result.data);
      router.replace('/');
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message ?? 'Registration failed';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>Create Account</Text>

      <View style={styles.typeRow}>
        {(['trucker', 'merchant'] as UserType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, userType === t && styles.typeBtnActive]}
            onPress={() => setUserType(t)}
          >
            <Text style={[styles.typeBtnText, userType === t && styles.typeBtnTextActive]}>
              {t === 'trucker' ? '🚛 Trucker' : '🏢 Merchant'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Ravi Kumar" />

      <Text style={styles.label}>Mobile Number *</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="9876543210" keyboardType="phone-pad" maxLength={10} />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="ravi@example.com" keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.label}>Password *</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min 8 characters" secureTextEntry />

      {userType === 'merchant' && (
        <>
          <Text style={styles.label}>GST Number (optional)</Text>
          <TextInput style={styles.input} value={gstNumber} onChangeText={setGstNumber} placeholder="22ABCDE1234F1Z5" autoCapitalize="characters" />
        </>
      )}

      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={isLoading}>
        {isLoading
          ? <ActivityIndicator color={colors.textInverse} />
          : <Text style={styles.btnText}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  inner: { padding: spacing[6], paddingTop: spacing[12] },
  title: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.textPrimary, marginBottom: spacing[6] },
  typeRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[6] },
  typeBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: borderRadius.lg, borderWidth: 2, borderColor: colors.gray300, alignItems: 'center' },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: '#FFF3E6' },
  typeBtnText: { fontSize: fontSize.base, color: colors.textSecondary, fontWeight: '500' },
  typeBtnTextActive: { color: colors.primary },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing[1] },
  input: { fontSize: fontSize.base, padding: spacing[3], borderWidth: 1, borderColor: colors.gray300, borderRadius: borderRadius.md, marginBottom: spacing[4] },
  btn: { backgroundColor: colors.primary, paddingVertical: spacing[4], borderRadius: borderRadius.lg, alignItems: 'center', marginBottom: spacing[4], marginTop: spacing[2] },
  btnText: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: '600' },
  link: { color: colors.primary, fontSize: fontSize.sm, textAlign: 'center' },
});
