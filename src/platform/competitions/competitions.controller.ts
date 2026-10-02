import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BetterAuthJwtGuard, CurrentUserId } from '../auth';
import { CompetitionAccessService } from './competition-access.service';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { JoinCompetitionDto } from './dto/join-competition.dto';
import { AuthenticatedUserThrottlerGuard } from './guards/authenticated-user-throttler.guard';
import { CompetitionJoinThrottlerGuard } from './guards/competition-join-throttler.guard';

@Controller('competitions')
export class CompetitionsController {
  constructor(
    private readonly competitions: CompetitionsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard, AuthenticatedUserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() body: CreateCompetitionDto,
  ) {
    return this.competitions.createCompetition(userId, body);
  }

  @UseGuards(BetterAuthJwtGuard, AuthenticatedUserThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get()
  async getAll(@CurrentUserId() userId: string) {
    return this.competitions.getAll(userId);
  }

  @UseGuards(BetterAuthJwtGuard, CompetitionJoinThrottlerGuard)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @Post('/join')
  async joinCompetition(
    @CurrentUserId() userId: string,
    @Body() body: JoinCompetitionDto,
  ) {
    return this.competitions.joinCompetition(userId, body);
  }

  @UseGuards(BetterAuthJwtGuard, AuthenticatedUserThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':competitionId')
  async getCompetition(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.competitions.getCompetition(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, AuthenticatedUserThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':competitionId/members')
  async getMembers(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );

    return this.competitions.getMembers(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, AuthenticatedUserThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Patch(':competitionId/seen')
  async markSeen(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.competitions.markSeen(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, AuthenticatedUserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Delete(':competitionId')
  async deleteCompetition(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);

    return this.competitions.deleteCompetition(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, AuthenticatedUserThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':competitionId/me')
  async getMe(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.competitions.getMe(userId, competitionId);
  }
}
