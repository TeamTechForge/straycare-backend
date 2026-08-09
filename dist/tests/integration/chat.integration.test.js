"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const setupIntegration_1 = require("../setupIntegration");
const Conversation = require('../../src/models/Conversation');
const Message = require('../../src/models/Message');
const app = require('../../src/app');
// Setup in-memory DB
(0, setupIntegration_1.setupTestDB)();
describe('Chat Integration Tests', () => {
    let user1Token;
    let user2Token;
    let user1Id;
    let user2Id;
    let mockSocketTo;
    let mockSocketEmit;
    beforeEach(async () => {
        // 1. Register User 1
        const res1 = await (0, supertest_1.default)(app).post('/api/auth/register').send({
            name: 'User One', email: 'user1@test.com', password: 'Password123!', phone: '+94771000001',
        });
        user1Token = res1.body.token;
        user1Id = res1.body.user.id;
        // 2. Register User 2
        const res2 = await (0, supertest_1.default)(app).post('/api/auth/register').send({
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
            const response = await (0, supertest_1.default)(app)
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
            await (0, supertest_1.default)(app)
                .post('/api/chat/conversations')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ participantId: user2Id });
            const response = await (0, supertest_1.default)(app)
                .get('/api/chat/conversations')
                .set('Authorization', `Bearer ${user1Token}`);
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
        });
    });
    describe('Messages API', () => {
        let conversationId;
        beforeEach(async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/chat/conversations')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ participantId: user2Id });
            conversationId = res.body._id;
        });
        it('should send a new message and emit socket event', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/chat/messages')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ conversationId, text: 'Hello User 2!' });
            expect(response.status).toBe(201);
            expect(response.body.text).toBe('Hello User 2!');
            // Verify DB updated
            const conv = await Conversation.findById(conversationId);
            expect(conv.unreadCounts.get(user2Id.toString())).toBe(1); // User 2 has 1 unread message
            expect(conv.lastMessage.text).toBe('Hello User 2!');
            // Verify Socket Emission
            expect(mockSocketTo).toHaveBeenCalledWith(conversationId);
            expect(mockSocketTo).toHaveBeenCalledWith(`user:${user2Id}`);
            expect(mockSocketEmit).toHaveBeenCalledWith('message:new', expect.any(Object));
        });
        it('should fetch paginated messages for a conversation', async () => {
            // Send message
            await (0, supertest_1.default)(app).post('/api/chat/messages').set('Authorization', `Bearer ${user1Token}`).send({ conversationId, text: 'First' });
            await (0, supertest_1.default)(app).post('/api/chat/messages').set('Authorization', `Bearer ${user2Token}`).send({ conversationId, text: 'Second' });
            const response = await (0, supertest_1.default)(app)
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
            await (0, supertest_1.default)(app)
                .post('/api/chat/messages')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ conversationId, text: 'Hello' });
            // User 2 marks as read
            const response = await (0, supertest_1.default)(app)
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
            const sendRes = await (0, supertest_1.default)(app)
                .post('/api/chat/messages')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ conversationId, text: 'Secret' });
            const messageId = sendRes.body._id;
            // Delete for everyone
            const response = await (0, supertest_1.default)(app)
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
    });
});
//# sourceMappingURL=chat.integration.test.js.map