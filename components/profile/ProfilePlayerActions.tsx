import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { spacing } from '@/constants/theme';

interface ProfilePlayerActionsProps {
  connectionStatus: 'none' | 'pending' | 'accepted';
  onConnect: () => void;
  onChallenge: () => void;
  onMessage: () => void;
}

export const ProfilePlayerActions = React.memo(function ProfilePlayerActions({
  connectionStatus,
  onConnect,
  onChallenge,
  onMessage,
}: ProfilePlayerActionsProps) {
  return (
    <Animated.View entering={FadeIn.delay(250).duration(300)} style={styles.row}>
      {connectionStatus === 'accepted' ? (
        <Button title="Message" onPress={onMessage} variant="gradient" style={styles.btn} />
      ) : (
        <Button
          title={connectionStatus === 'pending' ? 'Pending' : 'Connect'}
          onPress={onConnect}
          variant="gradient"
          disabled={connectionStatus === 'pending'}
          style={styles.btn}
        />
      )}
      <Button title="Challenge" onPress={onChallenge} variant="outline" style={styles.btn} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  btn: { flex: 1 },
});
