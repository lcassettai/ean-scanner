import { Module } from '@nestjs/common';
import { ViewerController } from './viewer.controller';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [SessionsModule],
  controllers: [ViewerController],
})
export class ViewerModule {}
