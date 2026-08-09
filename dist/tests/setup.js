"use strict";
// tests/setup.ts
// Global mocks for external SDKs and services
Object.defineProperty(exports, "__esModule", { value: true });
// 1. Mock Firebase Admin
jest.mock('firebase-admin', () => {
    return {
        apps: [],
        credential: {
            cert: jest.fn(),
        },
        initializeApp: jest.fn(),
        messaging: () => ({
            send: jest.fn().mockResolvedValue('projects/mock-project/messages/mock-message-id'),
            sendEachForMulticast: jest.fn().mockResolvedValue({
                responses: [],
                successCount: 0,
                failureCount: 0,
            }),
        }),
    };
});
// 2. Mock Cloudinary
jest.mock('cloudinary', () => {
    return {
        v2: {
            config: jest.fn(),
            uploader: {
                upload: jest.fn().mockResolvedValue({ secure_url: 'https://res.cloudinary.com/mock-url.jpg' }),
                upload_stream: jest.fn(),
            },
        },
    };
});
// 3. Mock Email Service (Nodemailer is wrapped in emailService.ts, so we mock our util directly)
jest.mock('../src/utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetCodeEmail: jest.fn().mockResolvedValue(true),
}));
// 4. Mock Socket.io (Globally disable any actual socket attachments)
jest.mock('socket.io', () => {
    return {
        Server: jest.fn().mockImplementation(() => ({
            on: jest.fn(),
            of: jest.fn().mockReturnValue({
                on: jest.fn(),
                emit: jest.fn(),
            }),
        })),
    };
});
// 5. Mock dotenv to prevent loading real .env in tests
jest.mock('dotenv', () => ({
    config: jest.fn(),
}));
// 6. Mock NotificationService to prevent actual Expo push notifications
jest.mock('../src/services/notificationService', () => ({
    NotificationService: {
        sendNotification: jest.fn().mockResolvedValue(true),
    },
}));
// Set global env vars for tests
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
//# sourceMappingURL=setup.js.map