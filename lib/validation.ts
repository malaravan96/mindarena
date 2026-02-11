/**
 * Validation utilities for form inputs
 */

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();

  if (!trimmed) {
    return 'Email is required';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address';
  }

  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }

  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();

  if (!trimmed) {
    return 'Username is required';
  }

  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters long';
  }

  if (trimmed.length > 20) {
    return 'Username must be 20 characters or less';
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return 'Username can only contain letters, numbers, hyphens, and underscores';
  }

  return null;
}

export function validateDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim();

  if (!trimmed) {
    return 'Display name is required';
  }

  if (trimmed.length < 2) {
    return 'Display name must be at least 2 characters long';
  }

  if (trimmed.length > 50) {
    return 'Display name must be 50 characters or less';
  }

  return null;
}
