import request from 'supertest';
import { setupTestDB } from '../setupIntegration';
import User from '../../src/models/User';
const Conversation = require('../../src/models/Conversation');
const Message = require('../../src/models/Message');

const app = require('../../src/app');

process.env.MESSAGE_ENCRYPTION_KEY = 'a'.repeat(64);

// Setup in-memory DB
setupTestDB();

jest.mock('../../src/services/notificationService', () => ({
  NotificationService: {
    sendPushOnly: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Chat Integration Tests', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  
  let mockSocketTo: any;
  let mockSocketEmit: any;

  beforeEach(async () => {
    // 1. Register User 1
    const res1 = await request(app).post('/api/auth/register').send({
      name: 'User One', email: 'user1@test.com', password: 'Password123!', phone: '+94771000001',
    });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // 2. Register User 2
    const res2 = await request(app).post('/api/auth/register').send({
      name: 'User Two', email: 'user2@test.com', password: 'Password123!', phone: '+94771000002',
    });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;

    // 3. Mock the Express Socket.io instance
    mockSocketEmit = jest.fn();
    mockSocketTo = jest.fn().mockReturnValue({ emit: mockSocketEmit });
    const mockIo = {
      of: jest.fn().mockReturnValue({
        to: mockSocketTo,
        emit: mockSocketEmit,
      }),
    };
    app.set('io', mockIo);
  });

  describe('Conversations API', () => {
    it('should create a new conversation if it does not exist', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.participants).toHaveLength(2);
      expect(response.body.permissions.canMessage).toBe(true);
    });

    it('should fetch all conversations for the user', async () => {
      // First create one
      await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id });

      const response = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });
  });

  describe('Messages API', () => {
    let conversationId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id });
      conversationId = res.body._id;
    });

    it('should send a new message and emit socket event', async () => {
      const response = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId, text: 'Hello User 2!' });

      expect(response.status).toBe(201);
      expect(response.body.text).toBe('Hello User 2!');
      
      // Verify DB updated
      const conv = await Conversation.findById(conversationId);
      expect(conv.unreadCounts.get(user2Id.toString())).toBe(1); // User 2 has 1 unread message
      expect(conv.lastMessage).toBeDefined();

      // Verify Socket Emission
      expect(mockSocketTo).toHaveBeenCalledWith(conversationId);
      expect(mockSocketTo).toHaveBeenCalledWith(`user:${user2Id}`);
      expect(mockSocketEmit).toHaveBeenCalledWith('message:new', expect.any(Object));
    });

    it('should fetch paginated messages for a conversation', async () => {
      // Send message
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${user1Token}`).send({ conversationId, text: 'First' });
      await request(app).post('/api/chat/messages').set('Authorization', `Bearer ${user2Token}`).send({ conversationId, text: 'Second' });

      const response = await request(app)
        .get(`/api/chat/messages/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      // Newest first by default in our controller
      expect(response.body[0].text).toBe('Second');
      expect(response.body[1].text).toBe('First');
    });

    it('should mark messages as read', async () => {
      // User 1 sends message
      await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId, text: 'Hello' });

      // User 2 marks as read
      const response = await request(app)
        .put(`/api/chat/messages/${conversationId}/read`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);

      // Verify DB
      const conv = await Conversation.findById(conversationId);
      expect(conv.unreadCounts.get(user2Id.toString())).toBe(0);

      // Verify socket emit
      expect(mockSocketEmit).toHaveBeenCalledWith('message:read-ack', expect.any(Object));
    });

    it('should soft delete a message for everyone', async () => {
      // Send
      const sendRes = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId, text: 'Secret' });
      const messageId = sendRes.body._id;

      // Delete for everyone
      const response = await request(app)
        .delete(`/api/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ type: 'everyone' });

      expect(response.status).toBe(200);

      // Verify DB
      const msg = await Message.findById(messageId);
      expect(msg.text).toBe('This message was deleted.');
      expect(msg.isDeletedForEveryone).toBe(true);
      
      // Verify socket emit
      expect(mockSocketEmit).toHaveBeenCalledWith('message:delete', expect.any(Object));
    });

    it('should reject an empty message', async () => {
      const response = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId, text: '' }); // empty message

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Text content is required');
    });

    it('should deny access to unauthorized conversation', async () => {
      // Create a third user
      const res3 = await request(app).post('/api/auth/register').send({
        name: 'User Three', email: 'user3@test.com', password: 'Password123!', phone: '+94771000003',
      });
      const user3Token = res3.body.token;

      // User 3 attempts to send a message to a conversation between User 1 and User 2
      const response = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${user3Token}`)
        .send({ conversationId, text: 'Sneaky message' });

      expect(response.status).toBe(404); // Not found or not a participant
    });
  });

  describe('Specific Conversation Types', () => {
    it('Start chat from Lost & Found: Open a Lost & Found listing and select the messaging option', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ 
          participantId: user2Id,
          conversationType: 'lost_found',
          relatedEntity: { item: '603b12345678901234567890', type: 'LostAndFound' }
        });

      expect(response.status).toBe(201);
      expect(response.body.conversationType).toBe('lost_found');
      expect(response.body.relatedEntity.item.toString()).toBe('603b12345678901234567890');
    });

    it('Send Lost & Found message: Send a message to the owner/poster of a Lost & Found listing', async () => {
      // Start the chat first
      const convRes = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ 
          participantId: user2Id,
          conversationType: 'lost_found',
          relatedEntity: { item: '603b12345678901234567890', type: 'LostAndFound' }
        });
      const convId = convRes.body._id;

      // Send the message
      const response = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId: convId, text: 'I found your dog!' });

      expect(response.status).toBe(201);
      expect(response.body.text).toBe('I found your dog!');
    });

    it('Start adoption chat: Open an Adoption listing and select the messaging option', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ 
          participantId: user2Id,
          conversationType: 'adoption',
          relatedEntity: { item: '603b12345678901234567891', type: 'Adoption' }
        });

      expect(response.status).toBe(201);
      expect(response.body.conversationType).toBe('adoption');
      expect(response.body.relatedEntity.item.toString()).toBe('603b12345678901234567891');
    });

    it('Send adoption message: Send a message regarding an Adoption listing', async () => {
      // Start the chat first
      const convRes = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ 
          participantId: user2Id,
          conversationType: 'adoption',
          relatedEntity: { item: '603b12345678901234567891', type: 'Adoption' }
        });
      const convId = convRes.body._id;

      // Send the message
      const response = await request(app)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ conversationId: convId, text: 'Is the cat still available?' });

      expect(response.status).toBe(201);
      expect(response.body.text).toBe('Is the cat still available?');
    });
  });
});
