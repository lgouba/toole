import { prisma } from '../lib/prisma.js';

export interface DriverStatsPeriod {
  /** Courses livrees (status delivered) sur la periode. */
  deliveredCount: number;
  /** Total des commissions gagnees (FCFA). */
  revenue: number;
  /** Pourboires recus (FCFA). */
  tips: number;
}

export interface DriverStatsDaily {
  /** ISO date YYYY-MM-DD */
  date: string;
  revenue: number;
  count: number;
}

export interface DriverStatsRanking {
  /** Position du livreur dans le classement par revenu sur 30j (1 = top). */
  position: number;
  /** Nombre total de livreurs actifs comparables. */
  total: number;
}

export interface DriverStats {
  today: DriverStatsPeriod;
  week: DriverStatsPeriod;
  month: DriverStatsPeriod;
  /** CA quotidien sur les 30 derniers jours (graphique). */
  last30Days: DriverStatsDaily[];
  ratingAvg: number;
  ratingCount: number;
  totalDeliveries: number;
  /** Taux d'acceptation = accepted / (accepted + ignored). 0-100. */
  acceptanceRate: number;
  /** Taux d'annulation = cancelledByDriver / totalAccepted. 0-100. */
  cancellationRate: number;
  ranking: DriverStatsRanking;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Calcule les stats d'un livreur. Toutes les requetes sont parallelisees
 * pour minimiser la latence.
 */
export async function getDriverStats(driverId: string): Promise<DriverStats> {
  const now = new Date();
  const today0 = startOfDay(now);
  const week0 = daysAgo(7);
  const month0 = daysAgo(30);

  // ---- En parallele : agregats par periode + cumul livraisons + ratings ----
  const [
    todayAgg,
    weekAgg,
    monthAgg,
    profile,
    rawDaily,
    rawAcceptance,
    rawCancel,
    rankingRows,
    monthRevenueRow,
  ] = await Promise.all([
    aggregateRevenue(driverId, today0, now),
    aggregateRevenue(driverId, week0, now),
    aggregateRevenue(driverId, month0, now),
    prisma.driverProfile.findUnique({
      where: { userId: driverId },
      include: {
        user: { select: { ratingAvg: true, ratingCount: true } },
      },
    }),
    // Daily breakdown : on prend les transactions commission completed
    prisma.$queryRawUnsafe<Array<{ date: Date; amount: bigint; count: bigint }>>(`
      SELECT
        DATE_TRUNC('day', t."createdAt") AS date,
        SUM(t.amount)::bigint AS amount,
        COUNT(*)::bigint AS count
      FROM "Transaction" t
      WHERE t."userId" = $1::uuid
        AND t.type = 'commission'
        AND t.status = 'completed'
        AND t."createdAt" >= $2
      GROUP BY DATE_TRUNC('day', t."createdAt")
      ORDER BY date ASC
    `, driverId, month0),
    // Acceptance rate : delivered + cancelled-by-driver sur les courses ou il a ete sollicite
    // Approximation : on regarde tous les deliveries ou status acceptedAt != null
    // pour ce driver vs il a accepte / annule. C'est imparfait mais suffisant.
    prisma.delivery.count({
      where: { driverId, acceptedAt: { not: null } },
    }),
    prisma.delivery.count({
      where: {
        driverId,
        status: 'cancelled',
        cancelledBy: driverId,
      },
    }),
    // Ranking : tous les livreurs actifs avec leur CA 30j
    prisma.$queryRawUnsafe<Array<{ userId: string; revenue: bigint }>>(`
      SELECT
        t."userId" AS "userId",
        SUM(t.amount)::bigint AS revenue
      FROM "Transaction" t
      INNER JOIN "DriverProfile" dp ON dp."userId" = t."userId"
      WHERE t.type = 'commission'
        AND t.status = 'completed'
        AND t."createdAt" >= $1
      GROUP BY t."userId"
      ORDER BY revenue DESC
    `, month0),
    // CA total du mois (pour le ranking : si pas dans le top, on calcule sa position)
    prisma.transaction.aggregate({
      where: {
        userId: driverId,
        type: 'commission',
        status: 'completed',
        createdAt: { gte: month0 },
      },
      _sum: { amount: true },
    }),
  ]);

  // Construit l'array de 30 jours en remplissant les jours sans transaction
  const dailyMap = new Map<string, { revenue: number; count: number }>();
  for (const row of rawDaily) {
    const key = formatDate(new Date(row.date));
    dailyMap.set(key, {
      revenue: Number(row.amount),
      count: Number(row.count),
    });
  }
  const last30Days: DriverStatsDaily[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const key = formatDate(d);
    const entry = dailyMap.get(key) ?? { revenue: 0, count: 0 };
    last30Days.push({ date: key, revenue: entry.revenue, count: entry.count });
  }

  // Ranking
  const myRevenue = Number(monthRevenueRow._sum.amount ?? 0);
  const myPos = rankingRows.findIndex((r) => r.userId === driverId);
  const ranking: DriverStatsRanking = {
    position: myPos >= 0 ? myPos + 1 : rankingRows.length + 1,
    total: Math.max(rankingRows.length, myPos >= 0 ? rankingRows.length : rankingRows.length + 1),
  };

  // Taux : approximations simples
  const totalDeliveredOrAccepted = rawAcceptance;
  const cancellationRate =
    totalDeliveredOrAccepted > 0
      ? Math.round((rawCancel / totalDeliveredOrAccepted) * 100)
      : 0;
  // Acceptance rate : approximee a (totalAccepted / (totalAccepted)) car on n'a
  // pas trace fiable des courses "ignorees" cote DB. On expose 100% si le
  // livreur n'a jamais annule, sinon 100 - cancellationRate.
  const acceptanceRate = Math.max(0, 100 - cancellationRate);

  return {
    today: todayAgg,
    week: weekAgg,
    month: monthAgg,
    last30Days,
    ratingAvg: Number(profile?.user?.ratingAvg ?? 5),
    ratingCount: profile?.user?.ratingCount ?? 0,
    totalDeliveries: profile?.totalDeliveries ?? 0,
    acceptanceRate,
    cancellationRate,
    ranking,
  };
}

async function aggregateRevenue(
  driverId: string,
  from: Date,
  to: Date,
): Promise<DriverStatsPeriod> {
  const [commissions, tips, deliveredCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId: driverId,
        type: 'commission',
        status: 'completed',
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId: driverId,
        type: 'tip',
        status: 'completed',
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
    prisma.delivery.count({
      where: {
        driverId,
        status: 'delivered',
        deliveredAt: { gte: from, lte: to },
      },
    }),
  ]);
  return {
    deliveredCount,
    revenue: Number(commissions._sum.amount ?? 0),
    tips: Number(tips._sum.amount ?? 0),
  };
}
