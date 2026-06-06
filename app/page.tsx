import { db } from '@/db'
import { tickets, activityLog } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { StatCards } from '@/components/dashboard/stat-cards'
import { RecentTickets } from '@/components/dashboard/recent-tickets'
import { DeptBreakdown } from '@/components/dashboard/dept-breakdown'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

async function getDashboardData() {
  const allTickets = await db.select().from(tickets)

  const totalOpen = allTickets.filter(t => t.status !== 'resolved').length
  const highPriority = allTickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length
  const escalated = allTickets.filter(t => t.status === 'escalated').length
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const resolvedThisWeek = allTickets.filter(
    t => t.status === 'resolved' && new Date(t.updatedAt) >= weekAgo
  ).length

  const recent = [...allTickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const deptMap = new Map<string, number>()
  allTickets.filter(t => t.status !== 'resolved').forEach(t => {
    deptMap.set(t.department, (deptMap.get(t.department) ?? 0) + 1)
  })
  const breakdown = [...deptMap.entries()]
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count)

  const activityEntries = await db.select({
    id: activityLog.id,
    ticketId: activityLog.ticketId,
    action: activityLog.action,
    actorName: activityLog.actorName,
    createdAt: activityLog.createdAt,
    ticketRef: tickets.ref,
  })
    .from(activityLog)
    .innerJoin(tickets, eq(activityLog.ticketId, tickets.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(8)

  return { totalOpen, highPriority, escalated, resolvedThisWeek, recent, breakdown, activityEntries }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>
      <StatCards
        totalOpen={data.totalOpen}
        highPriority={data.highPriority}
        escalated={data.escalated}
        resolvedThisWeek={data.resolvedThisWeek}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div>
          <RecentTickets tickets={data.recent} />
          <ActivityFeed entries={data.activityEntries} />
        </div>
        <div>
          <DeptBreakdown breakdown={data.breakdown} />
        </div>
      </div>
    </>
  )
}
