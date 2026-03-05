import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';

@Global()
@Module({})
export class FirebaseModule implements OnModuleInit {
    private readonly logger = new Logger(FirebaseModule.name);

    onModuleInit() {
        if (!admin.apps.length) {
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

            if (!projectId || !clientEmail || !privateKey) {
                this.logger.error('Firebase Admin SDK missing environment variables!');
                return;
            }

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
                projectId,
            });

            this.logger.log('Firebase Admin SDK initialized from environment variables');
        }
    }
}
