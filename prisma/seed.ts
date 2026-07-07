// /* eslint-disable */
// import { PrismaClient } from '@prisma/client';
// import bcrypt from 'bcrypt';

// const prisma = new PrismaClient();

// const hash = (p: string) => bcrypt.hash(p, 10);

// function genJoinCode() {
//   // simple deterministic-ish code for demo; feel free to replace with a better generator
//   return 'SPORTS1';
// }

// async function seed() {
//   console.log('🔰 Seeding start');

//   // ----- USERS -----
//   const passwordHash = await hash('password123');

//   const [alice, bob, charlie, jenny, alex] = await Promise.all([
//     prisma.user.upsert({
//       where: { email: 'alice@example.com' },
//       update: { displayName: 'Alice', passwordHash },
//       create: { email: 'alice@example.com', displayName: 'Alice', passwordHash },
//     }),
//     prisma.user.upsert({
//       where: { email: 'bob@example.com' },
//       update: { displayName: 'Bob', passwordHash },
//       create: { email: 'bob@example.com', displayName: 'Bob', passwordHash },
//     }),
//     prisma.user.upsert({
//       where: { email: 'charlie@example.com' },
//       update: { displayName: 'Charlie', passwordHash },
//       create: { email: 'charlie@example.com', displayName: 'Charlie', passwordHash },
//     }),
//     prisma.user.upsert({
//       where: { email: 'jenny@example.com' },
//       update: { displayName: 'Jenny', passwordHash },
//       create: { email: 'jenny@example.com', displayName: 'Jenny', passwordHash },
//     }),
//     prisma.user.upsert({
//       where: { email: 'alex@example.com' },
//       update: { displayName: 'Alex', passwordHash },
//       create: { email: 'alex@example.com', displayName: 'Alex', passwordHash },
//     }),
//   ]);

//   // ----- GAME (Sports Day Demo) -----
//   const existingGame = await prisma.game.findFirst({
//     where: { name: 'Sports Day Demo' },
//   });

//   // If the game exists, reuse it. Otherwise create it.
//   const game =
//     existingGame ??
//     (await prisma.game.create({
//       data: {
//         name: 'Sports Day Demo',
//         status: 'OPEN',
//         joinCode: genJoinCode(),
//         startingChips: 1000,
//         createdById: alice.id,
//         isDemo: true,
//         isTemplate: false,
//         lastActivityAt: new Date(),
//       },
//     }));

//   // Ensure joinCode is set to our demo code if you want it stable
//   // (If you prefer random join codes, remove this update.)
//   if (game.joinCode !== genJoinCode()) {
//     await prisma.game.update({
//       where: { id: game.id },
//       data: { joinCode: genJoinCode() },
//     });
//   }

//   // ----- MEMBERSHIPS -----
//   // Alice is HOST
//   await prisma.gameMember.upsert({
//     where: { gameId_userId: { gameId: game.id, userId: alice.id } },
//     update: { role: 'HOST' },
//     create: { gameId: game.id, userId: alice.id, role: 'HOST' },
//   });

//   // Bob/Charlie/Jenny join as PLAYERs. Alex intentionally left out.
//   const joiners = [bob, charlie, jenny];

//   // Use createMany + skipDuplicates
//   await prisma.gameMember.createMany({
//     data: joiners.map((u) => ({
//       gameId: game.id,
//       userId: u.id,
//       role: 'PLAYER',
//     })),
//     skipDuplicates: true,
//   });

//   // ----- STARTING CHIPS (LEDGER) -----
//   // CREDIT 1000 chips for members that don't already have a txn in this game
//   const membersToCredit = [alice, ...joiners];

//   for (const u of membersToCredit) {
//     const hasAny = await prisma.gameLedgerTxn.findFirst({
//       where: { gameId: game.id, userId: u.id },
//       select: { id: true },
//     });

//     if (!hasAny) {
//       await prisma.gameLedgerTxn.create({
//         data: {
//           gameId: game.id,
//           userId: u.id,
//           type: 'CREDIT',
//           amount: 1000,
//         },
//       });
//     }
//   }

//   // ----- TEAMS -----
//   // Deterministic: ensure these exist and are unique per (gameId, name)
//   const teamNames = ['Team A', 'Team B', 'Team C'];

//   const teams = await Promise.all(
//     teamNames.map((name) =>
//       prisma.team.upsert({
//         where: { gameId_name: { gameId: game.id, name } },
//         update: {},
//         create: {
//           gameId: game.id,
//           name,
//         },
//       }),
//     ),
//   );

//   const teamA = teams.find((t) => t.name === 'Team A')!;
//   const teamB = teams.find((t) => t.name === 'Team B')!;
//   const teamC = teams.find((t) => t.name === 'Team C')!;

//   // ----- MARKETS -----
//   async function findOrCreateMarket(name: string) {
//     // You have @@unique([gameId, name]) so we can use upsert properly:
//     return prisma.market.upsert({
//       where: { gameId_name: { gameId: game.id, name } },
//       update: { status: 'OPEN' },
//       create: { gameId: game.id, name, status: 'OPEN' },
//     });
//   }

//   const egg = await findOrCreateMarket('Egg & Spoon — Winner');
//   const three = await findOrCreateMarket('3-Legged Race — Winner');
//   const sack = await findOrCreateMarket('Sack Race — Winner');
//   const bonus = await findOrCreateMarket('Bonus Market — Yes/No (label-only)');

//   // Clear old selections for these markets (deterministic seed)
//   await prisma.selection.deleteMany({
//     where: { marketId: { in: [egg.id, three.id, sack.id, bonus.id] } },
//   });

//   // Create selections: team-based for the races, label-based for a yes/no example
//   await prisma.selection.createMany({
//     data: [
//       // Egg & Spoon (A/B/C)
//       { marketId: egg.id, teamId: teamA.id, label: 'Team A', decimalOdds: 1.8 },
//       { marketId: egg.id, teamId: teamB.id, label: 'Team B', decimalOdds: 2.1 },
//       { marketId: egg.id, teamId: teamC.id, label: 'Team C', decimalOdds: 3.2 },

//       // 3-Legged (A/C)
//       { marketId: three.id, teamId: teamA.id, label: 'Team A', decimalOdds: 2.0 },
//       { marketId: three.id, teamId: teamC.id, label: 'Team C', decimalOdds: 1.9 },

//       // Sack Race (B/C)
//       { marketId: sack.id, teamId: teamB.id, label: 'Team B', decimalOdds: 2.4 },
//       { marketId: sack.id, teamId: teamC.id, label: 'Team C', decimalOdds: 1.75 },

//       // Label-only market (no teamId)
//       { marketId: bonus.id, label: 'Yes', decimalOdds: 1.9 },
//       { marketId: bonus.id, label: 'No', decimalOdds: 1.9 },
//     ],
//   });

//   // Update lastActivityAt since we created game content
//   await prisma.game.update({
//     where: { id: game.id },
//     data: { lastActivityAt: new Date() },
//   });

//   // ----- LOG COUNTS -----
//   const [userCount, gameCount, marketCount, selectionCount, memberCount, ledgerRows] =
//     await Promise.all([
//       prisma.user.count(),
//       prisma.game.count(),
//       prisma.market.count({ where: { gameId: game.id } }),
//       prisma.selection.count({ where: { market: { gameId: game.id } } }),
//       prisma.gameMember.count({ where: { gameId: game.id } }),
//       prisma.gameLedgerTxn.count({ where: { gameId: game.id } }),
//     ]);

//   console.log('✅ Seed complete', {
//     users: userCount, // 5
//     games: gameCount,
//     marketsInGame: marketCount, // 4
//     selectionsInGame: selectionCount, // 11 (7 team-based + 2 label-only + etc)
//     membersInGame: memberCount, // 4 (Alice + Bob + Charlie + Jenny)
//     ledgerRowsInGame: ledgerRows, // credits created
//     gameId: game.id,
//     joinCode: genJoinCode(),
//     host: 'alice@example.com',
//     joiners: ['bob@example.com', 'charlie@example.com', 'jenny@example.com'],
//     leftOutForTesting: 'alex@example.com',
//   });
// }

// seed()
//   .catch((e) => {
//     console.error('❌ Seed failed:', e);
//     process.exit(1);
//   })
//   .finally(async () => prisma.$disconnect());
