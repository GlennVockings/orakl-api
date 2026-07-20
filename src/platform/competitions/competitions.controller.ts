import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { BetterAuthJwtGuard, CurrentUserId } from '../auth';
import { JoinCompetitionDto } from './dto/join-competition.dto';
import { CompetitionAccessService } from './competition-access.service';

@Controller('competitions')
export class CompetitionsController {
  constructor(
    private readonly competitions: CompetitionsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() body: CreateCompetitionDto,
  ) {
    return this.competitions.createCompetition(userId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getAll(@CurrentUserId() userId: string) {
    return this.competitions.getAll(userId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post('/join')
  async joinCompetition(
    @CurrentUserId() userId: string,
    @Body() body: JoinCompetitionDto,
  ) {
    return this.competitions.joinCompetition(userId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get(':competitionId')
  async getCompetition(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.competitions.getCompetition(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Patch(':competitionId/seen')
  async markSeen(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.competitions.markSeen(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Delete(':competitionId')
  async deleteCompetition(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.competitions.deleteCompetition(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get(':competitionId/me')
  async getMe(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    return this.competitions.getMe(userId, competitionId);
  }
}
