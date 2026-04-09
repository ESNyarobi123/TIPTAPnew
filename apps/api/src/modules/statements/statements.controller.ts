import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { StatementGenerateDto, StatementQueryDto } from './dto/statement-query.dto';
import { StatementsService } from './statements.service';

const STATEMENT_ACCURACY_NOTE =
  'On-demand rollup from local DB only (not provider-signed). Totals exclude fees unless modeled; ' +
  'netMovementApproxCents is collections + completed digital tip payments minus completed payouts — ' +
  'does not replace accounting or settlement. Tips use Tip rows + PaymentTransaction; cash vs digital semantics apply.';

@ApiTags('statements')
@ApiBearerAuth()
@Controller('statements')
@UseGuards(RolesGuard)
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get('by-key/:statementKey')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'Recompute statement from deterministic key (base64url JSON params)',
    description: STATEMENT_ACCURACY_NOTE,
  })
  getByKey(@CurrentUser() user: AuthUser, @Param('statementKey') statementKey: string) {
    const dto = this.statements.parseKey(statementKey);
    return this.statements.buildStatement(user, dto);
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'Generate statement (same payload as GET, for large clients)',
    description: STATEMENT_ACCURACY_NOTE,
  })
  generate(@CurrentUser() user: AuthUser, @Body() body: StatementGenerateDto) {
    return this.statements.buildStatement(user, body);
  }

  @Get()
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'On-demand merchant statement for a period (query params)',
    description: STATEMENT_ACCURACY_NOTE,
  })
  getByQuery(@CurrentUser() user: AuthUser, @Query() q: StatementQueryDto) {
    return this.statements.buildStatement(user, q);
  }
}
