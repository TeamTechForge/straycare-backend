import { mockRequest, mockResponse, mockNext } from '../../helpers/mockRequestResponse';

// Mock catchAsync to return raw function
jest.mock('../../../src/utils/catchAsync', () => ({
  catchAsync: (fn: any) => fn,
}));

const Conversation = require('../../../src/models/Conversation');
const Message = require('../../../src/models/Message');
const User = require('../../../src/models/User');
const NGOProfile = require('../../../src/models/NGOProfile');
import PrivacyService from '../../../src/services/privacyService';
const chatController = require('../../../src/controllers/chatController');

jest.mock('../../../src/models/Conversation');
jest.mock('../../../src/models/Message');
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/NGOProfile');
jest.mock('../../../src/services/privacyService');

describe('Chat Controller Unit Tests', () => {
  let req: any;
  let res: any;
  let next: any;
  let mockSocketTo: any;
  let mockSocketEmit: any;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    req.user = { id: 'user1' };

    mockSocketEmit = jest.fn();
    mockSocketTo = jest.fn().mockReturnValue({ emit: mockSocketEmit });
    const mockIo = {
      of: jest.fn().mockReturnValue({
        to: mockSocketTo,
        emit: mockSocketEmit,
      }),
    };
    req.app = { get: jest.fn().mockReturnValue(mockIo) };

    jest.clearAllMocks();
  });

  describe('getOrCreateConversation', () => {
    it('should require participantId', async () => {
      req.body = {};
      await chatController.getOrCreateConversation(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'participantId is required' });
    });

    it('should block starting a conversation with oneself', async () => {
      req.body = { participantId: 'user1' };
      await chatController.getOrCreateConversation(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cannot start a conversation with yourself' });
    });

    it('should return existing conversation and evaluate permissions (Duplicate check)', async () => {
      req.body = { participantId: 'user2' };
      const mockPrivacy = { allowed: true };
      (PrivacyService.canMessage as jest.Mock).mockResolvedValue(mockPrivacy);

      const mockConversation = {
        _id: 'conv1',
        participants: [{ _id: 'user1' }, { _id: 'user2', role: 'ngo' }]
      };
      
      const mockFindOne = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockConversation)
      };
      Conversation.findOne.mockReturnValue(mockFindOne);
      NGOProfile.findOne.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ orgName: 'NGO' }) });

      await chatController.getOrCreateConversation(req, res, next);
      expect(Conversation.findOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        _id: 'conv1',
        permissions: { canMessage: true }
      }));
    });
  });

  describe('sendMessage', () => {
    it('should enforce privacy restrictions when sending a message', async () => {
      req.body = { conversationId: 'conv1', text: 'Hello' };
      
      Conversation.findOne.mockResolvedValue({
        _id: 'conv1',
        participants: ['user1', 'user2']
      });

      // PrivacyService blocks it
      (PrivacyService.canMessage as jest.Mock).mockResolvedValue({ allowed: false, reason: 'Blocked' });

      await chatController.sendMessage(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Blocked' });
      expect(Message.create).not.toHaveBeenCalled();
    });

    it('should save message and emit socket events', async () => {
      req.body = { conversationId: 'conv1', text: 'Hello' };
      
      const mockConversation = {
        _id: 'conv1',
        participants: ['user1', 'user2'],
        unreadCounts: new Map(),
        save: jest.fn().mockResolvedValue(true)
      };
      
      Conversation.findOne.mockResolvedValue(mockConversation);
      (PrivacyService.canMessage as jest.Mock).mockResolvedValue({ allowed: true });
      
      const mockMessage = { _id: 'msg1', createdAt: new Date() };
      Message.create.mockResolvedValue(mockMessage);
      
      Message.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockMessage)
      });

      await chatController.sendMessage(req, res, next);

      expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello', sender: 'user1' }));
      expect(mockConversation.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      
      // Verify Socket Emits
      expect(mockSocketTo).toHaveBeenCalledWith('conv1');
      expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
      expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
      expect(mockSocketEmit).toHaveBeenCalledWith('message:new', expect.any(Object));
    });
  });

  describe('markAsRead', () => {
    it('should update messages and reset unread counts (Read Receipts)', async () => {
      req.params = { conversationId: 'conv1' };
      
      const mockConversation = {
        _id: 'conv1',
        participants: ['user1', 'user2'],
        unreadCounts: new Map([['user1', 5]]),
        save: jest.fn().mockResolvedValue(true)
      };
      
      Conversation.findOne.mockResolvedValue(mockConversation);
      Message.updateMany.mockResolvedValue({ modifiedCount: 5 });

      await chatController.markAsRead(req, res, next);

      expect(Message.updateMany).toHaveBeenCalledWith(
        { conversationId: 'conv1', readBy: { $ne: 'user1' } },
        { $addToSet: { readBy: 'user1' } }
      );
      expect(mockConversation.unreadCounts.get('user1')).toBe(0);
      expect(mockConversation.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      
      // Socket emit for read-ack
      expect(mockSocketTo).toHaveBeenCalledWith('conv1');
      expect(mockSocketEmit).toHaveBeenCalledWith('message:read-ack', expect.any(Object));
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete message for everyone if user is sender', async () => {
      req.params = { messageId: 'msg1' };
      req.body = { type: 'everyone' };
      
      const mockMessage = {
        _id: 'msg1',
        conversationId: 'conv1',
        sender: 'user1', // User is sender
        createdAt: new Date(1000), // Same time
        text: 'Hello', // Will be overwritten by controller on delete
        isDeletedForEveryone: false, // Will be set to true by controller
        save: jest.fn().mockResolvedValue(true)
      };
      Message.findById.mockResolvedValue(mockMessage);
      
      const mockConversation = {
        _id: 'conv1',
        participants: ['user1', 'user2'],
        lastMessage: { createdAt: new Date(1000) },
        save: jest.fn().mockResolvedValue(true)
      };
      Conversation.findOne.mockResolvedValue(mockConversation);

      await chatController.deleteMessage(req, res, next);

      expect(mockMessage.text).toBe('This message was deleted.');
      expect(mockMessage.isDeletedForEveryone).toBe(true);
      expect(mockMessage.save).toHaveBeenCalled();
      expect(mockConversation.save).toHaveBeenCalled();
      
      // Socket emit for delete
      expect(mockSocketTo).toHaveBeenCalledWith('conv1');
      expect(mockSocketEmit).toHaveBeenCalledWith('message:delete', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Security and Invalid states', () => {
    it('should return 404 for invalid conversation ID in sendMessage', async () => {
      req.body = { conversationId: 'invalid_id', text: 'hi' };
      Conversation.findOne.mockResolvedValue(null);

      await chatController.sendMessage(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Conversation not found' });
    });
  });
});
