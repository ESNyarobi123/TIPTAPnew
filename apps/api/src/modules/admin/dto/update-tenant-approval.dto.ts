import { ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const approvalWorkflowStates = [
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
] as const;

export const approvalRiskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type ApprovalWorkflowState = (typeof approvalWorkflowStates)[number];
export type ApprovalRiskLevel = (typeof approvalRiskLevels)[number];

export class UpdateTenantApprovalDto {
  @ApiPropertyOptional({ enum: approvalWorkflowStates })
  @IsOptional()
  @IsIn([...approvalWorkflowStates])
  workflowStatus?: ApprovalWorkflowState;

  @ApiPropertyOptional({ enum: approvalRiskLevels })
  @IsOptional()
  @IsIn([...approvalRiskLevels])
  riskLevel?: ApprovalRiskLevel;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  tenantStatus?: TenantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  nextActions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedReviewerUserId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  legalIdentityVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  contactVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentReady?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  branchReady?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  catalogReady?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  staffingReady?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  channelReady?: boolean;
}
