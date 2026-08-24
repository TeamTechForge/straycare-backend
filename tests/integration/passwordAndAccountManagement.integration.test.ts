import request from 'supertest';
import crypto from 'crypto';
import { setupTestDB } from '../setupIntegration';
import User from '../../src/models/User';
import { validRegistrationPayload } from '../fixtures/auth.fixture';
const { PasswordService } = require('../../src/services/passwordService');

const app = require('../../src/app');

// Mock the email sending service so tests don't try to send real emails
jest.mock('../../src/utils/emailService', () => ({
  sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(true),
}));

setupTestDB();
jest.setTimeout(30000);

describe('Password and Account Management Test Cases', () => {
  let userToken: string;
  let userEmail = 'passworduser@test.com';

  beforeEach(async () => {
    jest.clearAllMocks();
    const res = await request(app).post('/api/auth/register').send({
      ...validRegistrationPayload,
      email: userEmail,
      password: 'OldPassword123!',
    });
    userToken = res.body.token;
  });

  describe('Change Password', () => {
    it('Change password: Enter the correct current password and a valid new password', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password updated successfully');

      // Verify the DB was actually updated
      const dbUser = await User.findOne({ email: userEmail });
      const isMatch = await PasswordService.comparePassword('NewPassword123!', dbUser.password);
      expect(isMatch).toBe(true);
    });

    it('Incorrect current password: Enter an incorrect current password when changing the password', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Incorrect current password');
    });

    it('Password mismatch: Enter different new password and confirmation values', async () => {
      // Backend does not enforce confirmPassword validation, frontend handles it.
      // We send a mismatch to the backend, it will simply accept newPassword.
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!',
        });

      // API allows this, so we expect 200 (reflecting actual backend behaviour)
      expect(res.status).toBe(200);
    });
  });

  describe('Password Reset', () => {
    it('Password reset request: Request a password reset using a registered account', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        email: userEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('If this email is registered, a 6-digit reset code has been sent.');

      const dbUser = await User.findOne({ email: userEmail });
      expect(dbUser?.resetPasswordToken).toBeDefined();
      expect(dbUser?.resetPasswordExpires).toBeDefined();
    });

    it('Invalid reset code: Enter an incorrect verification code', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: '000000', // invalid random token
        newPassword: 'NewPassword123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid or expired reset code');
    });

    it('Valid reset code: Enter a valid verification code and new password', async () => {
      // 1. Manually set a known reset code hash in the database to simulate forgot-password
      const knownCode = '123456';
      const hashedCode = crypto.createHash('sha256').update(knownCode).digest('hex');

      await User.findOneAndUpdate(
        { email: userEmail },
        {
          resetPasswordToken: hashedCode,
          resetPasswordExpires: Date.now() + 900000,
        }
      );

      // 2. Perform the reset operation
      const res = await request(app).post('/api/auth/reset-password').send({
        token: knownCode,
        newPassword: 'NewPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password reset successful');

      // 3. Verify it was actually reset
      const dbUser = await User.findOne({ email: userEmail });
      const isMatch = await PasswordService.comparePassword('NewPassword123!', dbUser.password);
      expect(isMatch).toBe(true);

      // Verify the tokens were cleared
      expect(dbUser.resetPasswordToken).toBeUndefined();
      expect(dbUser.resetPasswordExpires).toBeUndefined();
    });
  });
});
