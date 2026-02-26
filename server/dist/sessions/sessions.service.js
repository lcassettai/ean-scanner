"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const short_url_util_1 = require("../utils/short-url.util");
const sync_1 = require("csv-stringify/sync");
let SessionsService = class SessionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createSession(dto) {
        const shortCode = (0, short_url_util_1.generateShortCode)();
        const accessCode = (0, short_url_util_1.generateAccessCode)();
        const session = await this.prisma.session.create({
            data: {
                shortCode,
                accessCode,
                name: dto.name,
                type: dto.type ?? null,
                scans: {
                    create: this.mergeScans(dto.scans),
                },
            },
            include: { scans: true },
        });
        return {
            shortCode: session.shortCode,
            accessCode: session.accessCode,
            name: session.name,
            type: session.type,
            totalScans: session.scans.length,
        };
    }
    async addScans(code, dto) {
        const session = await this.prisma.session.findUnique({
            where: { shortCode: code },
            include: { scans: true },
        });
        if (!session)
            throw new common_1.NotFoundException('Session not found');
        const incoming = this.mergeScans(dto.scans);
        for (const item of incoming) {
            const existing = session.scans.find((s) => s.ean === item.ean);
            if (existing) {
                await this.prisma.scan.update({
                    where: { id: existing.id },
                    data: { quantity: existing.quantity + item.quantity },
                });
            }
            else {
                await this.prisma.scan.create({
                    data: { ean: item.ean, quantity: item.quantity, sessionId: session.id },
                });
            }
        }
        const updated = await this.prisma.session.findUnique({
            where: { shortCode: code },
            include: { scans: true },
        });
        return { shortCode: code, totalScans: updated.scans.length };
    }
    async getSession(code) {
        const session = await this.prisma.session.findUnique({
            where: { shortCode: code },
            include: { scans: { orderBy: { scannedAt: 'asc' } } },
        });
        if (!session)
            throw new common_1.NotFoundException('Session not found');
        return session;
    }
    async exportCsv(code) {
        const session = await this.getSession(code);
        const rows = session.scans.map((s) => ({
            EAN: s.ean,
            Cantidad: s.quantity,
        }));
        return (0, sync_1.stringify)(rows, { header: true });
    }
    async verifyAccess(code, accessCode) {
        const session = await this.prisma.session.findUnique({
            where: { shortCode: code },
            include: { scans: { orderBy: { scannedAt: 'asc' } } },
        });
        if (!session)
            throw new common_1.NotFoundException('Session not found');
        if (session.accessCode !== accessCode)
            return null;
        return session;
    }
    mergeScans(scans) {
        const map = new Map();
        for (const s of scans) {
            map.set(s.ean, (map.get(s.ean) ?? 0) + s.quantity);
        }
        return Array.from(map.entries()).map(([ean, quantity]) => ({ ean, quantity }));
    }
};
exports.SessionsService = SessionsService;
exports.SessionsService = SessionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SessionsService);
//# sourceMappingURL=sessions.service.js.map