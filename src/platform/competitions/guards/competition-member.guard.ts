import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompetitionAccessService } from '../competition-access.service';
import type { CompetitionRequest } from '../types/authenticated-request';
import { getCompetitionId } from '../utils/get-competition-id';

@Injectable()
export class CompetitionMemberGuard implements CanActivate {
  constructor(private readonly competitionAccess: CompetitionAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CompetitionRequest>();

    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user was not found');
    }

    const competitionId = getCompetitionId(request);

    const membership = await this.competitionAccess.requireCompetitionMember(
      userId,
      competitionId,
    );

    request.competitionMember = membership;

    return true;
  }
}
