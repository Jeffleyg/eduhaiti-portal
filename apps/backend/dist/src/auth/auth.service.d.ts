import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "@prisma/client";
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    requestCode(email: string): Promise<{
        delivered: boolean;
        devCode?: string;
    }>;
    verifyCode(email: string, code: string): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            enrollmentNumber: string | null;
            name: string | null;
            mustChangePassword: boolean;
            role: import(".prisma/client").$Enums.Role;
            isActive: boolean;
        };
    }>;
    getProfile(userId: string): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        mustChangePassword: boolean;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    } | null>;
    login(email: string, password: string): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            name: string | null;
            isActive: true;
            mustChangePassword: boolean;
            enrollmentNumber: string | null;
        };
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
    }>;
    signup(email: string, name: string, role: Role): Promise<{
        id: string;
        email: string;
        name: string | null;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>;
}
