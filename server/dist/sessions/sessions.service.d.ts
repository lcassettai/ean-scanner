import { PrismaService } from '../prisma/prisma.service';
import { AddScansDto, CreateSessionDto } from './dto/create-session.dto';
export declare class SessionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createSession(dto: CreateSessionDto): Promise<{
        shortCode: string;
        accessCode: string;
        name: string;
        type: string | null;
        totalScans: number;
    }>;
    addScans(code: string, dto: AddScansDto): Promise<{
        shortCode: string;
        totalScans: number;
    }>;
    getSession(code: string): Promise<{
        scans: {
            id: number;
            ean: string;
            quantity: number;
            scannedAt: Date;
            sessionId: number;
        }[];
    } & {
        shortCode: string;
        accessCode: string;
        name: string;
        type: string | null;
        createdAt: Date;
        id: number;
    }>;
    exportCsv(code: string): Promise<string>;
    verifyAccess(code: string, accessCode: string): Promise<({
        scans: {
            id: number;
            ean: string;
            quantity: number;
            scannedAt: Date;
            sessionId: number;
        }[];
    } & {
        shortCode: string;
        accessCode: string;
        name: string;
        type: string | null;
        createdAt: Date;
        id: number;
    }) | null>;
    private mergeScans;
}
