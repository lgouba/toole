import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Fond blanc par défaut : sinon les écrans héritent du gris par défaut
        // de React Navigation (rgb(242,242,242)) qui apparaît sous la carte.
        contentStyle: { backgroundColor: '#fff' },
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
