import { ConfigService } from '@nestjs/config';
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: {
        sub: string;
        email: string;
        role: string;
        schoolId?: string | null;
    }): Promise<{
        sub: string;
        email: string;
        role: string;
        schoolId?: string | null;
    }>;
}
export {};
