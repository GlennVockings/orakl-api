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
import { FauxStakesAdminGuard } from '../../../platform/competitions/guards/faux-stakes-admin.guard';
import { FauxStakesMemberGuard } from '../../../platform/competitions/guards/faux-stakes-member.guard';
import { CreateTeamsDto } from './dto/create-team.dto';
import { EditTeamsDto } from './dto/edit-team.dto';
import { TeamsService } from './teams.service';

@Controller('/competitions/:competitionId/faux-stakes/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @UseGuards(BetterAuthJwtGuard, FauxStakesAdminGuard)
  @Post()
  async createTeams(
    @Param('competitionId')
    competitionId: string,
    @Body() body: CreateTeamsDto,
  ) {
    return this.teams.createTeams(competitionId, body);
  }

  @UseGuards(BetterAuthJwtGuard, FauxStakesMemberGuard)
  @Get()
  async getTeams(
    @Param('competitionId')
    competitionId: string,
  ) {
    return this.teams.getTeams(competitionId);
  }

  @UseGuards(BetterAuthJwtGuard, FauxStakesAdminGuard)
  @Patch()
  async editTeam(
    @Param('competitionId')
    competitionId: string,
    @Body() body: EditTeamsDto,
  ) {
    return this.teams.editTeam(competitionId, body);
  }
}
