import { PasswordService } from '../../../src/services/passwordService';
import bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('PasswordService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash the password with the default salt rounds (10)', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await PasswordService.hashPassword('myPassword');

      expect(bcrypt.hash).toHaveBeenCalledWith('myPassword', 10);
      expect(result).toBe('hashed-password');
    });

    it('should hash the password with a custom number of salt rounds', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('custom-hashed-password');

      const result = await PasswordService.hashPassword('myPassword', 12);

      expect(bcrypt.hash).toHaveBeenCalledWith('myPassword', 12);
      expect(result).toBe('custom-hashed-password');
    });
  });

  describe('comparePassword', () => {
    it('should return true if passwords match', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await PasswordService.comparePassword('myPassword', 'hashed-password');

      expect(bcrypt.compare).toHaveBeenCalledWith('myPassword', 'hashed-password');
      expect(result).toBe(true);
    });

    it('should return false if passwords do not match', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await PasswordService.comparePassword('wrongPassword', 'hashed-password');

      expect(bcrypt.compare).toHaveBeenCalledWith('wrongPassword', 'hashed-password');
      expect(result).toBe(false);
    });
  });
});
