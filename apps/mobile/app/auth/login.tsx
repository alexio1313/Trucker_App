import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@truck-platform/state';
import { colors, fontSize, spacing, borderRadius } from '@truck-platform/ui-kit';
import { isValidIndianPhone } from '@truck-platform/shared';

type Step = 'phone' | 'otp' | 'password';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [usePassword, setUsePassword] = useState(false);

  const { sendOtp, loginWithOtp, login, isLoading, error, clearError } = useAuthStore();

  async function handlePhoneSubmit() {
    const normalized = phone.startsWith('+91') ? phone : `+91${phone}`;
    if (!isValidIndianPhone(normalized)) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (usePassword) {
      setStep('password');
    } else {
      await sendOtp(normalized);
      setStep('otp');
    }
  }

  async function handleOtpSubmit() {
    const normalized = phone.startsWith('+91') ? phone : `+91${phone}`;
    await loginWithOtp(normalized, otp);
    router.replace('/');
  }

  async function handlePasswordSubmit() {
    const normalized = phone.startsWith('+91') ? phone : `+91${phone}`;
    await login(normalized, password);
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>TruckPlatform</Text>
        <Text style={styles.subtitle}>India's Smartest Freight Network</Text>

        {step === 'phone' && (
          <>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(v) => { setPhone(v); clearError(); }}
              />
            </View>
            <TouchableOpacity
              style={styles.btn}
              onPress={handlePhoneSubmit}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={styles.btnText}>{usePassword ? 'Continue' : 'Send OTP'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUsePassword((p) => !p)}>
              <Text style={styles.link}>
                {usePassword ? 'Use OTP instead' : 'Use password instead'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={styles.link}>Don't have an account? Register</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'otp' && (
          <>
            <Text style={styles.label}>Enter OTP sent to +91{phone}</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit OTP"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />
            <TouchableOpacity style={styles.btn} onPress={handleOtpSubmit} disabled={isLoading}>
              {isLoading
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={styles.btnText}>Verify & Login</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')}>
              <Text style={styles.link}>Change number</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'password' && (
          <>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.btn} onPress={handlePasswordSubmit} disabled={isLoading}>
              {isLoading
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={styles.btnText}>Login</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')}>
              <Text style={styles.link}>Back</Text>
            </TouchableOpacity>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  inner: { flex: 1, padding: spacing[6], justifyContent: 'center' },
  logo: { fontSize: fontSize['3xl'], fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: spacing[1] },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing[10] },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing[2] },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] },
  countryCode: { fontSize: fontSize.md, color: colors.textPrimary, paddingHorizontal: spacing[3], paddingVertical: spacing[3], borderWidth: 1, borderColor: colors.gray300, borderRadius: borderRadius.md, marginRight: spacing[2] },
  phoneInput: { flex: 1, fontSize: fontSize.md, paddingHorizontal: spacing[3], paddingVertical: spacing[3], borderWidth: 1, borderColor: colors.gray300, borderRadius: borderRadius.md },
  input: { fontSize: fontSize.md, paddingHorizontal: spacing[3], paddingVertical: spacing[3], borderWidth: 1, borderColor: colors.gray300, borderRadius: borderRadius.md, marginBottom: spacing[4] },
  btn: { backgroundColor: colors.primary, paddingVertical: spacing[4], borderRadius: borderRadius.lg, alignItems: 'center', marginBottom: spacing[4] },
  btnText: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: '600' },
  link: { color: colors.primary, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing[3] },
  error: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing[2] },
});
