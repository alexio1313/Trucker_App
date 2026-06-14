import { Tabs } from 'expo-router';
import { colors, fontSize } from '@truck-platform/ui-kit';

export default function MerchantLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarLabelStyle: { fontSize: fontSize.xs },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="post-load" options={{ title: 'Post Load' }} />
      <Tabs.Screen name="my-loads" options={{ title: 'My Loads' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
