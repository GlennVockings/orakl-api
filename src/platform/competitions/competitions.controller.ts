import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { BetterAuthJwtGuard } from '../auth/better-auth-jwt.guard';
import { getUserIdFromJwtPayload } from '../auth/auth-user';
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
    @Req() req: { user: string },
    @Body() body: CreateCompetitionDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.competitions.createCompetition(userId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getAll(@Req() req: { user: string }) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.competitions.getAll(userId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Post('/join')
  async joinCompetition(
    @Req() req: { user: string },
    @Body() body: JoinCompetitionDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.competitions.joinCompetition(userId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get(':competitionId')
  async getCompetition(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.competitions.getCompetition(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Patch(':competitionId/seen')
  async markSeen(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.competitions.markSeen(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Delete(':competitionId')
  async deleteCompetition(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.competitions.deleteCompetition(userId, competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get(':competitionId/me')
  async getMe(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    return this.competitions.getMe(userId, competitionId);
  }
}
