import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SessionsService } from './sessions.service';
import { AddScansDto, CreateSessionDto, JoinSessionDto, ExtendSessionDto, UpdateScanDto } from './dto/create-session.dto';

@Controller('api/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // Crear sesión: máximo 5 por minuto por IP
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  createSession(@Body() dto: CreateSessionDto) {
    return this.sessionsService.createSession(dto);
  }

  // Extender: máximo 10 por minuto por IP
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':code/extend')
  async extendSession(@Param('code') code: string, @Body() dto: ExtendSessionDto, @Res() res: Response) {
    const result = await this.sessionsService.extendSession(code, dto.accessCode);
    if (!result) return res.status(401).json({ error: 'Código incorrecto' });
    return res.json(result);
  }

  // Join/recuperar: máximo 10 por minuto por IP
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':code/join')
  async joinSession(@Param('code') code: string, @Body() dto: JoinSessionDto, @Res() res: Response) {
    const session = await this.sessionsService.joinSession(code, dto.accessCode);
    if (!session) return res.status(401).json({ error: 'Código incorrecto' });
    return res.json(session);
  }

  // Agregar scans: máximo 30 por minuto por IP (uso legítimo puede ser frecuente)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':code/scans')
  addScans(@Param('code') code: string, @Body() dto: AddScansDto) {
    return this.sessionsService.addScans(code, dto);
  }

  // Editar scan individual desde viewer: máximo 30 por minuto por IP
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Patch(':code/scans')
  async updateScan(@Param('code') code: string, @Body() dto: UpdateScanDto, @Res() res: Response) {
    const result = await this.sessionsService.updateScan(code, dto);
    if (!result) return res.status(401).json({ error: 'Acceso incorrecto o ítem no encontrado' });
    return res.json(result);
  }

  // Eliminar scans: máximo 10 por minuto por IP
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Delete(':code/scans')
  deleteScans(@Param('code') code: string, @Body() body: { eans: string[] }) {
    return this.sessionsService.deleteScans(code, body.eans);
  }

  @Get(':code')
  getSession(@Param('code') code: string) {
    return this.sessionsService.getSession(code);
  }

  @Get(':code/export')
  async exportCsv(
    @Param('code') code: string,
    @Query('fields') fields: string | undefined,
    @Res() res: Response,
  ) {
    const selectedFields = fields ? fields.split(',').map((f) => f.trim()) : undefined;
    const { csv, sessionName } = await this.sessionsService.exportCsv(code, selectedFields);
    const safeName = sessionName.replace(/[/\\:*?"<>|]/g, '_').trim();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.csv`);
    res.send('\uFEFF' + csv); // BOM para Excel
  }
}
