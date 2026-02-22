import { ConfigService } from "@nestjs/config";
export declare class EmailService {
    private readonly configService;
    private transporter;
    private fromAddress;
    constructor(configService: ConfigService);
    sendTempPasswordEmail(to: string, tempPassword: string, expiresAt: Date): Promise<void>;
}
