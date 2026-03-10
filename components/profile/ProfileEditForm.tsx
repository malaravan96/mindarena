import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ProfileSectionHeading } from './ProfileSectionHeading';
import { spacing } from '@/constants/theme';

const DISPLAY_NAME_MAX = 50;
const USERNAME_MAX = 20;
const BIO_MAX = 160;

interface ProfileEditFormProps {
  displayName: string;
  username: string;
  bio: string;
  onDisplayNameChange: (v: string) => void;
  onUsernameChange: (v: string) => void;
  onBioChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  hasChanges: boolean;
}

export const ProfileEditForm = React.memo(function ProfileEditForm({
  displayName,
  username,
  bio,
  onDisplayNameChange,
  onUsernameChange,
  onBioChange,
  onSave,
  saving,
  hasChanges,
}: ProfileEditFormProps) {
  return (
    <Animated.View entering={FadeIn.delay(200).duration(300)}>
      <Card style={styles.card} padding="lg">
        <ProfileSectionHeading
          icon="person-outline"
          title="Personal Details"
          subtitle="Keep your profile up to date"
        />

        <Input
          label="Display Name"
          value={displayName}
          onChangeText={onDisplayNameChange}
          placeholder="Enter your display name"
          autoCapitalize="words"
          editable={!saving}
          maxLength={DISPLAY_NAME_MAX}
          showCharacterCount
          clearable
        />

        <Input
          label="Username"
          value={username}
          onChangeText={onUsernameChange}
          placeholder="Choose a username"
          autoCapitalize="none"
          editable={!saving}
          autoCorrect={false}
          maxLength={USERNAME_MAX}
          showCharacterCount
          clearable
          helperText="Letters, numbers, hyphens, and underscores only"
        />

        <Input
          label="Bio"
          value={bio}
          onChangeText={onBioChange}
          placeholder="Tell us about yourself"
          multiline
          numberOfLines={3}
          editable={!saving}
          maxLength={BIO_MAX}
          showCharacterCount
          helperText="Optional short intro"
          style={styles.bioInput}
        />

        <Button
          title={saving ? 'Saving...' : 'Save Profile'}
          onPress={onSave}
          disabled={saving || !displayName.trim() || !hasChanges}
          loading={saving}
          variant="gradient"
          fullWidth
          size="lg"
          style={styles.saveBtn}
        />
      </Card>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { marginTop: spacing.sm },
});
