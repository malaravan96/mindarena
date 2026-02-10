import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'MindArena' }} />
      <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
