import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { PublicAbuseThrottle } from '../../common/decorators/public-abuse-throttle.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { ConversationMessageDto } from './dto/conversation-message.dto';
import { ListConversationSessionsQueryDto } from './dto/list-sessions-query.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { ConversationsService } from './conversations.service';

function requireSessionHeader(h: string | string[] | undefined): string {
  if (typeof h !== 'string' || h.length < 16) {
    throw new UnauthorizedException('X-Session-Token header is required');
  }
  return h;
}

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post('start')
  @Public()
  @PublicAbuseThrottle(30, 60_000)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start session from validated QR secret (public; returns opaque sessionToken only)',
  })
  start(@Body() body: StartConversationDto) {
    return this.conversations.start(body);
  }

  @Post('message')
  @Public()
  @PublicAbuseThrottle(60, 60_000)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send customer message (public; sessionToken in body)' })
  message(@Body() body: ConversationMessageDto) {
    return this.conversations.message(body);
  }

  @Get('session')
  @Public()
  @ApiHeader({ name: 'X-Session-Token', required: true })
  @ApiOperation({ summary: 'Get current session state (customer); X-Session-Token only — no internal session id' })
  getCustomerSession(@Headers('x-session-token') token: string | undefined) {
    return this.conversations.getCustomerSession(requireSessionHeader(token));
  }

  @Post('session/reset')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'X-Session-Token', required: true })
  @ApiOperation({ summary: 'Reset session (customer); clears messages and state' })
  resetCustomerSession(@Headers('x-session-token') token: string | undefined) {
    return this.conversations.resetCustomerSession(requireSessionHeader(token));
  }

  @Get('internal/:sessionId')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Staff: get session by internal id (JWT; tenant-scoped)' })
  getStaffSession(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthUser) {
    return this.conversations.getSessionForStaff(sessionId, user);
  }

  @Get('internal/:sessionId/messages')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Staff: list transcript messages for one session' })
  getStaffSessionMessages(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthUser) {
    return this.conversations.getSessionMessagesForStaff(sessionId, user);
  }

  @Post('internal/:sessionId/reset')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Staff: reset session by internal id' })
  resetStaffSession(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthUser) {
    return this.conversations.resetSessionForStaff(sessionId, user);
  }

  @Get('internal')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Staff: list sessions (tenant-scoped; SUPER_ADMIN can omit tenantId)' })
  listSessions(@CurrentUser() user: AuthUser, @Query() q: ListConversationSessionsQueryDto) {
    return this.conversations.listSessionsForStaff(user, q);
  }
}
