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

@Controller('/competitions/:competitionId/faux-stakes/teams')
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard)
  @Post()
  async createTeams(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
    @Body() body: CreateTeamsDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.teams.createTeams(competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getTeams(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );
    return this.teams.getTeams(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Patch()
  async editTeam(
    @Req() req: { user: string },
    @Param('competitionId') competitionId: string,
    @Body() body: EditTeamsDto,
  ) {
    const userId = getUserIdFromJwtPayload(req.user);
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.teams.editTeam(competitionId, body);
  }
}
