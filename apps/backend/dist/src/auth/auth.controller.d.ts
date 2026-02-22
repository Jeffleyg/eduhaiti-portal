import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
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
        mustChangePassword: boolean;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    } | null>;
}
