import { JwtService } from '../../../src/services/jwtService';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('JwtService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  const mockPayload = { id: '6a76295f94f8d7329b65475f', role: 'general_user' };

  describe('generateToken', () => {
    it('should generate an access token with correct payload and options', () => {
      (jwt.sign as jest.Mock).mockReturnValue('mock-access-token');

      const token = JwtService.generateToken(mockPayload, '1h');

      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-secret',
        { expiresIn: '1h' }
      );
      expect(token).toBe('mock-access-token');
    });

    it('should use default 7d expiration if not provided', () => {
      (jwt.sign as jest.Mock).mockReturnValue('mock-access-token');

      JwtService.generateToken(mockPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-secret',
        { expiresIn: '7d' }
      );
    });

    it('should throw an error if JWT_SECRET is missing', () => {
      delete (process.env as any).JWT_SECRET;

      expect(() => JwtService.generateToken(mockPayload)).toThrow('JWT_SECRET is not configured on the server');
    });
  });

  describe('verifyToken', () => {
    it('should verify token using JWT_SECRET', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const decoded = JwtService.verifyToken('mock-access-token');

      expect(jwt.verify).toHaveBeenCalledWith('mock-access-token', 'test-secret');
      expect(decoded).toEqual(mockPayload);
    });

    it('should throw an error if JWT_SECRET is missing during verify', () => {
      delete (process.env as any).JWT_SECRET;
      
      expect(() => JwtService.verifyToken('mock-token')).toThrow('JWT_SECRET is not configured on the server');
    });
  });
});
