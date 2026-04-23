import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "@prisma/client";
import { UpdateProfileDto } from "./dto/update-profile.dto";
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
        firstName: string | null;
        lastName: string | null;
        dateOfBirth: Date | null;
        address: string | null;
        gender: import(".prisma/client").$Enums.Gender | null;
        fatherName: string | null;
        motherName: string | null;
        mustChangePassword: boolean;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
        classesTeaching: {
            id: string;
            name: string;
            level: string;
        }[];
        classesAttending: {
            id: string;
            name: string;
            level: string;
        }[];
    } | null>;
    updateProfile(userId: string, payload: UpdateProfileDto): Promise<{
        id: string;
        email: string;
        enrollmentNumber: string | null;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
        dateOfBirth: Date | null;
        address: string | null;
        gender: import(".prisma/client").$Enums.Gender | null;
        fatherName: string | null;
        motherName: string | null;
        mustChangePassword: boolean;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
        classesTeaching: {
            id: string;
            name: string;
            level: string;
        }[];
        classesAttending: {
            id: string;
            name: string;
            level: string;
        }[];
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
    logout(userId: string, email?: string): Promise<{
        success: boolean;
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
    getTestCredentials(): {
        admin: {
            role: "ADMIN";
            email: string;
            password: any;
        };
        teacher: {
            role: "TEACHER";
            email: string;
            password: any;
        };
        student: {
            role: "STUDENT";
            email: string;
            password: any;
        };
    };
    private logAccessEvent;
}
