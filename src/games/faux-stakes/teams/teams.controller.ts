import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BetterAuthJwtGuard, CurrentUserId } from '../../../platform/auth';
import { TeamsService } from './teams.service';
import { CreateTeamsDto } from './dto/create-team.dto';
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
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Body() body: CreateTeamsDto,
  ) {
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.teams.createTeams(competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Get()
  async getTeams(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
  ) {
    await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );
    return this.teams.getTeams(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard)
  @Patch()
  async editTeam(
    @CurrentUserId() userId: string,
    @Param('competitionId') competitionId: string,
    @Body() body: EditTeamsDto,
  ) {
    await this.competitionAccess.requireCompetitionAdmin(userId, competitionId);
    return this.teams.editTeam(competitionId, body);
  }
}
