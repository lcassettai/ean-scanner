import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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

  @Get(':code')
  getSession(@Param('code') code: string) {
    return this.sessionsService.getSession(code);
  }

  @Get(':code/export')
  async exportCsv(@Param('code') code: string, @Res() res: Response) {
    const csv = await this.sessionsService.exportCsv(code);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${code}.csv"`);
    res.send('\uFEFF' + csv); // BOM para Excel
  }
}
