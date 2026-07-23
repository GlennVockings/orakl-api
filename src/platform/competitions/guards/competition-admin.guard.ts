import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompetitionAccessService } from '../competition-access.service';
import type { CompetitionRequest } from '../types/authenticated-request';

@Injectable()
export class CompetitionAdminGuard implements CanActivate {
  constructor(private readonly competitionAccess: CompetitionAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CompetitionRequest>();

    const userId = request.user?.id;
    const competitionIdParam = request.params.competitionId;

    if (!competitionIdParam || Array.isArray(competitionIdParam)) {
      throw new BadRequestException('Competition ID was not provided');
    }

    const competitionId = competitionIdParam;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user was not found');
    }

    if (!competitionId) {
      throw new BadRequestException('Competition ID was not provided');
    }

    const membership = await this.competitionAccess.requireCompetitionAdmin(
      userId,
      competitionId,
    );

    request.competitionMember = membership;

    return true;
  }
}
