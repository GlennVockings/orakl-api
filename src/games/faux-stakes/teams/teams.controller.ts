import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BetterAuthJwtGuard } from '../../../platform/auth/better-auth-jwt.guard';
import { TeamsService } from './teams.service';
import { CreateTeamsDto } from './dto/create-team.dto';
import { getUserIdFromJwtPayload } from 'src/platform/auth/auth-user';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';
import { EditTeamsDto } from './dto/edit-team.dto';

@Controller('games/:gameId/teams')
export class TeamsController {
  constructor(
    private teams: TeamsService,
    private competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post()
  async createTeams(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
    @Body() body: CreateTeamsDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, gameId);
    return this.teams.createTeams(gameId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getTeams(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionMember(userId, gameId);
    return this.teams.getTeams(gameId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Patch()
  async editTeam(
    @Req() req: { user: string },
    @Param('gameId') gameId: string,
    @Body() body: EditTeamsDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, gameId);
    return this.teams.editTeam(gameId, body);
  }
}
