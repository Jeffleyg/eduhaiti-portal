import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as fs from 'fs';
import * as path from 'path';

const profilePhotoDir = path.join(process.cwd(), 'uploads', 'profile-photos');

if (!fs.existsSync(profilePhotoDir)) {
  fs.mkdirSync(profilePhotoDir, { recursive: true });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Get('test-credentials')
  getTestCredentials() {
    return this.authService.getTestCredentials();
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: { user?: { sub?: string; email?: string } }) {
    return this.authService.logout(req.user?.sub ?? '', req.user?.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Req() req: { user?: { sub?: string } },
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user?.sub ?? '',
      body.currentPassword,
      body.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    return this.authService.getProfile(userId ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  updateProfile(
    @Req() req: { user?: { sub?: string } },
    @Body() body: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user?.sub ?? '', body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile-photo')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: diskStorage({
        destination: profilePhotoDir,
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${uniqueSuffix}${extension}`);
        },
      }),
    }),
  )
  async uploadProfilePhoto(
    @Req() req: { user?: { sub?: string } },
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const profilePhotoPath = `/uploads/profile-photos/${file.filename}`;

    await this.authService.updateProfile(req.user?.sub ?? '', {
      profilePhoto: profilePhotoPath,
    });

    return this.authService.getProfile(req.user?.sub ?? '');
  }
}
