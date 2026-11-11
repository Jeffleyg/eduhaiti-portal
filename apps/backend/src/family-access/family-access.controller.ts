import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { FamilyAccessService } from './family-access.service';
import { FamilyAuthService, FamilySession } from './family-auth.service';
import { FamilySessionGuard } from './family-session.guard';
import {
  FamilyContactRequestDto,
  RequestFamilyCodeDto,
  VerifyFamilyCodeDto,
} from './dto/family-access.dto';

@Controller('family')
export class FamilyAccessController {
  constructor(
    private readonly familyAccessService: FamilyAccessService,
    private readonly familyAuth: FamilyAuthService,
  ) {}

  /** Step 1: send an SMS code to a guardian phone registered for the student. */
  @Post('access/request-code')
  requestAccessCode(@Body() body: RequestFamilyCodeDto) {
    return this.familyAuth.requestCode(body.enrollmentNumber, body.phone);
  }

  /** Step 2: exchange the code for a short family session. */
  @Post('access/verify')
  verifyAccessCode(@Body() body: VerifyFamilyCodeDto) {
    return this.familyAuth.verifyCode(
      body.enrollmentNumber,
      body.phone,
      body.code,
    );
  }

  @UseGuards(FamilySessionGuard)
  @Get('overview')
  getFamilyOverview(@Req() req: { family: FamilySession }) {
    return this.familyAccessService.getFamilyOverview(req.family.studentId);
  }

  @UseGuards(FamilySessionGuard)
  @Post('contact-request')
  createFamilyContactRequest(
    @Req() req: { family: FamilySession },
    @Body() payload: FamilyContactRequestDto,
  ) {
    return this.familyAccessService.createFamilyContactRequest({
      studentId: req.family.studentId,
      guardianName: req.family.guardianName,
      guardianPhone: req.family.guardianPhone,
      subject: payload.subject,
      body: payload.body,
      urgent: payload.urgent,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @Get('admin/contact-requests')
  listFamilyContactRequests(
    @Req() req: { user?: { schoolId?: string | null } },
  ) {
    return this.familyAccessService.listFamilyContactRequests(
      req.user?.schoolId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @Post('admin/contact-requests/:requestId/respond')
  respondFamilyContactRequest(
    @Param('requestId') requestId: string,
    @Req() req: { user?: { sub?: string; schoolId?: string | null } },
    @Body()
    payload: {
      responseMessage: string;
      notifyFamily?: boolean;
    },
  ) {
    return this.familyAccessService.respondToFamilyContactRequest({
      requestId,
      responseMessage: payload.responseMessage,
      notifyFamily: payload.notifyFamily,
      actorId: req.user?.sub ?? '',
      schoolId: req.user?.schoolId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @Post('admin/notices')
  createSchoolFamilyNotice(
    @Req() req: { user?: { sub?: string; schoolId?: string | null } },
    @Body()
    payload: {
      enrollmentNumber: string;
      title: string;
      body: string;
      severity?: 'normal' | 'urgent';
      channel?: 'IN_APP' | 'SMS' | 'BOTH';
      guardianPhone?: string;
    },
  ) {
    return this.familyAccessService.createSchoolFamilyNotice({
      ...payload,
      actorId: req.user?.sub ?? '',
      schoolId: req.user?.schoolId,
    });
  }
}
