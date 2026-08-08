import { AuthValidator } from '../../../src/validators/authValidator';

describe('AuthValidator', () => {
  describe('validateRegistrationPayload', () => {
    it('should return isValid true for a completely valid payload', () => {
      const validPayload = {
        name: 'Test User',
        email: 'valid.email@example.com',
        phone: '+94771234567',
        password: 'Password123',
      };

      const result = AuthValidator.validateRegistrationPayload(validPayload);
      expect(result).toEqual({ isValid: true });
    });

    it('should return isValid false if name is missing', () => {
      const invalidPayload = {
        email: 'test@example.com',
        phone: '+94771234567',
        password: 'Password123',
      };

      const result = AuthValidator.validateRegistrationPayload(invalidPayload);
      expect(result).toEqual({ isValid: false, message: 'All fields are required' });
    });

    it('should return isValid false if email is missing', () => {
      const invalidPayload = {
        name: 'Test',
        phone: '+94771234567',
        password: 'Password123',
      };

      const result = AuthValidator.validateRegistrationPayload(invalidPayload);
      expect(result).toEqual({ isValid: false, message: 'All fields are required' });
    });

    it('should return isValid false if phone is missing', () => {
      const invalidPayload = {
        name: 'Test',
        email: 'test@test.com',
        password: 'Password123',
      };

      const result = AuthValidator.validateRegistrationPayload(invalidPayload);
      expect(result).toEqual({ isValid: false, message: 'All fields are required' });
    });

    it('should return isValid false if password is missing', () => {
      const invalidPayload = {
        name: 'Test',
        email: 'test@test.com',
        phone: '+94771234567',
      };

      const result = AuthValidator.validateRegistrationPayload(invalidPayload);
      expect(result).toEqual({ isValid: false, message: 'All fields are required' });
    });

    it('should return isValid false if password is less than 6 characters', () => {
      const invalidPayload = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+94771234567',
        password: '12345',
      };

      const result = AuthValidator.validateRegistrationPayload(invalidPayload);
      expect(result).toEqual({ isValid: false, message: 'Password must be at least 6 characters long' });
    });

    it('should return isValid false if email format is invalid', () => {
      const invalidPayload = {
        name: 'Test User',
        email: 'invalid-email-format',
        phone: '+94771234567',
        password: 'Password123',
      };

      const result = AuthValidator.validateRegistrationPayload(invalidPayload);
      expect(result).toEqual({ isValid: false, message: 'Invalid email format' });
    });
  });
});
