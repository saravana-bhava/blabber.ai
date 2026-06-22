# Multi-Factor Authentication (MFA) Implementation

This document describes the Multi-Factor Authentication implementation for the Blabber application using Supabase.

## Overview

The MFA implementation provides an additional layer of security for user accounts using Time-based One-Time Password (TOTP) authentication. Users can enable MFA through their account settings and will be required to enter a 6-digit code from their authenticator app when signing in.

## Features Implemented

### 1. MFA Settings Component (`src/components/account/mfa-settings.tsx`)
- **Enable MFA**: Users can enable MFA by scanning a QR code with their authenticator app
- **Disable MFA**: Users can disable MFA with confirmation
- **Status Display**: Shows current MFA status (enabled/disabled)
- **QR Code Generation**: Displays QR code for easy setup with authenticator apps
- **TOTP Verification**: Input field for 6-digit codes during setup

### 2. Enhanced Login Form (`src/components/login-form.tsx`)
- **MFA Detection**: Automatically detects if MFA is enabled for a user
- **MFA Prompt**: Shows MFA code input when required during sign-in
- **Fallback Handling**: Graceful handling when MFA verification is needed

### 3. API Routes (`src/app/api/auth/mfa/route.ts`)
- **GET /api/auth/mfa**: Returns current MFA status and factors
- **POST /api/auth/mfa**: Handles MFA enrollment and unenrollment
  - `action: 'enroll'`: Enrolls user in TOTP MFA
  - `action: 'unenroll'`: Removes MFA from user account

### 4. Account Page Integration
- MFA settings card added to the account page
- Positioned between password change and blocked users sections

## Technical Implementation

### Supabase MFA API Usage
The implementation uses Supabase's built-in MFA functionality:

```typescript
// Enroll in TOTP MFA
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp'
});

// List MFA factors
const { data: factors } = await supabase.auth.mfa.listFactors();

// Unenroll MFA factor
const { error } = await supabase.auth.mfa.unenroll({
  factorId: factorId
});
```

### Supported Authenticator Apps
Users can use any TOTP-compatible authenticator app:
- Google Authenticator
- Authy
- 1Password
- Microsoft Authenticator
- Any other TOTP-compatible app

## Current Limitations

1. **MFA Challenge API**: The full MFA challenge verification during sign-in is not fully implemented due to API compatibility issues with the current Supabase version. The UI is prepared for this functionality.

2. **OAuth Integration**: MFA with OAuth providers (Google, Apple) may require additional configuration.

## Future Enhancements

1. **Complete MFA Challenge**: Implement full MFA verification during sign-in
2. **Backup Codes**: Generate and provide backup codes for account recovery
3. **Multiple Factors**: Support for additional MFA methods (SMS, email)
4. **Admin Controls**: Allow administrators to enforce MFA for certain user groups

## Security Considerations

1. **QR Code Security**: QR codes are generated securely and contain the TOTP secret
2. **Session Management**: MFA status is checked on each authentication attempt
3. **API Security**: MFA operations require valid user sessions
4. **Error Handling**: Sensitive error messages are filtered to prevent information leakage

## Usage Instructions

### For Users

1. **Enable MFA**:
   - Go to Account Settings
   - Click "Enable MFA"
   - Scan the QR code with your authenticator app
   - Enter the 6-digit code to verify setup

2. **Disable MFA**:
   - Go to Account Settings
   - Click "Disable MFA"
   - Confirm the action

3. **Sign In with MFA**:
   - Enter your email and password
   - If MFA is enabled, enter the 6-digit code from your authenticator app

### For Developers

The MFA implementation is modular and can be easily extended:

```typescript
// Check MFA status
const response = await fetch('/api/auth/mfa');
const { mfaEnabled } = await response.json();

// Enable MFA
const response = await fetch('/api/auth/mfa', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'enroll' })
});
```

## Dependencies

- Supabase v2.49.4+ (for MFA support)
- React 19+
- Next.js 15+
- Lucide React (for icons)

## Environment Variables

No additional environment variables are required for MFA functionality. It uses the existing Supabase configuration. 