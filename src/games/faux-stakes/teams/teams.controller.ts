import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BetterAuthJwtGuard } from '../../../platform/auth';
import { TeamsService } from './teams.service';
import { CreateTeamsDto } from './dto/create-team.dto';
import { CompetitionAccessService } from '../../../platform/competitions/competition-access.service';
import { EditTeamsDto } from './dto/edit-team.dto';
import { CompetitionMemberGuard } from 'src/platform/competitions/guards/competition-member.guard';
import { CompetitionAdminGuard } from 'src/platform/competitions/guards/competition-admin.guard';

@Controller('/competitions/:competitionId/faux-stakes/teams')
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly competitionAccess: CompetitionAccessService,
  ) {}

  @UseGuards(BetterAuthJwtGuard, CompetitionAdminGuard)
  @Post()
  async createTeams(
    @Param('competitionId') competitionId: string,
    @Body() body: CreateTeamsDto,
  ) {
    return this.teams.createTeams(competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard, CompetitionMemberGuard)
  @Get()
  async getTeams(@Param('competitionId') competitionId: string) {
    return this.teams.getTeams(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, CompetitionAdminGuard)
  @Patch()
  async editTeam(
    @Param('competitionId') competitionId: string,
    @Body() body: EditTeamsDto,
  ) {
    return this.teams.editTeam(competitionId, body);
  }
}
