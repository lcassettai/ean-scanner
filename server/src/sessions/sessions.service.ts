import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateShortCode, generateAccessCode } from '../utils/short-url.util';
import { AddScansDto, CreateSessionDto, ScanItemDto } from './dto/create-session.dto';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(dto: CreateSessionDto) {
    const shortCode = generateShortCode();
    const accessCode = generateAccessCode();

    const session = await this.prisma.session.create({
      data: {
        shortCode,
        accessCode,
        name: dto.name,
        type: dto.type ?? null,
        askInternalCode: dto.askInternalCode ?? false,
        askProductName: dto.askProductName ?? false,
        askPrice: dto.askPrice ?? false,
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
      askInternalCode: session.askInternalCode,
      askProductName: session.askProductName,
      askPrice: session.askPrice,
      totalScans: session.scans.length,
    };
  }

  async addScans(code: string, dto: AddScansDto) {
    const session = await this.prisma.session.findUnique({
      where: { shortCode: code },
      include: { scans: true },
    });

    if (!session) throw new NotFoundException('Session not found');

    const incoming = this.mergeScans(dto.scans);

    for (const item of incoming) {
      const existing = session.scans.find((s) => s.ean === item.ean);
      if (existing) {
        await this.prisma.scan.update({
          where: { id: existing.id },
          data: {
            quantity:     existing.quantity + item.quantity,
            internalCode: item.internalCode ?? existing.internalCode,
            productName:  item.productName  ?? existing.productName,
            price:        item.price        ?? existing.price,
          },
        });
      } else {
        await this.prisma.scan.create({
          data: {
            ean:          item.ean,
            quantity:     item.quantity,
            internalCode: item.internalCode,
            productName:  item.productName,
            price:        item.price,
            sessionId:    session.id,
          },
        });
      }
    }

    const updated = await this.prisma.session.findUnique({
      where: { shortCode: code },
      include: { scans: true },
    });

    return { shortCode: code, totalScans: updated!.scans.length };
  }

  async getSession(code: string) {
    const session = await this.prisma.session.findUnique({
      where: { shortCode: code },
      include: { scans: { orderBy: { scannedAt: 'asc' } } },
    });

    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async exportCsv(code: string, fields?: string[]): Promise<string> {
    const session = await this.getSession(code);

    const all = {
      EAN:            (s: typeof session.scans[0]) => s.ean,
      Cantidad:       (s: typeof session.scans[0]) => s.quantity,
      CodigoInterno:  (s: typeof session.scans[0]) => s.internalCode ?? '',
      NombreProducto: (s: typeof session.scans[0]) => s.productName  ?? '',
      Precio:         (s: typeof session.scans[0]) => s.price        ?? '',
    };

    const fieldMap: Record<string, keyof typeof all> = {
      ean:           'EAN',
      quantity:      'Cantidad',
      internalCode:  'CodigoInterno',
      productName:   'NombreProducto',
      price:         'Precio',
    };

    const selected: (keyof typeof all)[] = fields && fields.length > 0
      ? fields.map((f) => fieldMap[f]).filter(Boolean)
      : (Object.keys(all) as (keyof typeof all)[]);

    const rows = session.scans.map((s) => {
      const row: Record<string, unknown> = {};
      for (const col of selected) row[col] = all[col](s);
      return row;
    });

    return stringify(rows, { header: true });
  }

  async deleteScans(code: string, eans: string[]) {
    const session = await this.prisma.session.findUnique({ where: { shortCode: code } });
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.scan.deleteMany({
      where: { sessionId: session.id, ean: { in: eans } },
    });
    return { ok: true };
  }

  async verifyAccess(code: string, accessCode: string) {
    const session = await this.prisma.session.findUnique({
      where: { shortCode: code },
      include: { scans: { orderBy: { scannedAt: 'asc' } } },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.accessCode !== accessCode) return null;
    return session;
  }

  private mergeScans(scans: ScanItemDto[]): ScanItemDto[] {
    const map = new Map<string, ScanItemDto>();
    for (const s of scans) {
      const existing = map.get(s.ean);
      if (existing) {
        existing.quantity     += s.quantity;
        existing.internalCode  = s.internalCode ?? existing.internalCode;
        existing.productName   = s.productName  ?? existing.productName;
        existing.price         = s.price        ?? existing.price;
      } else {
        map.set(s.ean, { ...s });
      }
    }
    return Array.from(map.values());
  }
}
