import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionsService } from './sessions.service';
import { AddScansDto, CreateSessionDto } from './dto/create-session.dto';

@Controller('api/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  createSession(@Body() dto: CreateSessionDto) {
    return this.sessionsService.createSession(dto);
  }

  @Post(':code/scans')
  addScans(@Param('code') code: string, @Body() dto: AddScansDto) {
    return this.sessionsService.addScans(code, dto);
  }

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
