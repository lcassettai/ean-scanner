import type { Response } from 'express';
import { SessionsService } from '../sessions/sessions.service';
export declare class ViewerController {
    private readonly sessionsService;
    constructor(sessionsService: SessionsService);
    serveViewer(code: string, res: Response): void;
    verifyAccess(code: string, body: {
        accessCode: string;
    }, res: Response): Promise<Response<any, Record<string, any>>>;
    private buildViewerHtml;
}
