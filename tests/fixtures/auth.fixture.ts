// tests/fixtures/auth.fixture.ts
import mongoose from 'mongoose';

export const mockUserId = new mongoose.Types.ObjectId().toString();

export const validRegistrationPayload = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '+94771234567',
  password: 'Password123!',
};

export const validLoginPayload = {
  email: 'test@example.com',
  password: 'Password123!',
};

export const mockUserDoc = {
  _id: mockUserId,
  name: 'Test User',
  email: 'test@example.com',
  phone: '+94771234567',
  password: 'hashedpassword',
  role: 'general_user',
  profileCompleted: false,
  roleSelected: false,
  save: jest.fn().mockResolvedValue(true),
};
