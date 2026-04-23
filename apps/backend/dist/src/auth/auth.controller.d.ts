import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(body: LoginDto): Promise<{
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
    logout(req: {
        user?: {
            sub?: string;
            email?: string;
        };
    }): Promise<{
        success: boolean;
    }>;
    changePassword(req: {
        user?: {
            sub?: string;
        };
    }, body: ChangePasswordDto): Promise<{
        success: boolean;
    }>;
    getProfile(req: {
        user?: {
            sub?: string;
        };
    }): Promise<{
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
    updateProfile(req: {
        user?: {
            sub?: string;
        };
    }, body: UpdateProfileDto): Promise<{
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
}
