import { config } from 'dotenv'
config({ path: '.env.local' })

import { db } from './index'
import { teamMembers, tickets, boardOrder, activityLog, comments } from './schema'

const memberData = [
  { name: 'Sarah Chen', role: 'Housing Officer', initials: 'SC', color: '#4F7CFF' },
  { name: 'Marcus Johnson', role: 'Highways Inspector', initials: 'MJ', color: '#22C55E' },
  { name: 'Priya Patel', role: 'Planning Officer', initials: 'PP', color: '#F59E0B' },
  { name: 'Tom Walsh', role: 'Environmental Officer', initials: 'TW', color: '#EF4444' },
  { name: 'Lisa Kim', role: 'Parks Manager', initials: 'LK', color: '#8B5CF6' },
]

async function seed() {
  // Clear in FK-safe order
  await db.delete(activityLog)
  await db.delete(boardOrder)
  await db.delete(comments)
  await db.delete(tickets)
  await db.delete(teamMembers)

  const members = await db.insert(teamMembers).values(memberData).returning()
  const [sarah, marcus, priya, tom, lisa] = members

  const ticketData = [
    { ref: 'LCI-001', title: 'Pothole on Thornton Road causing vehicle damage', status: 'in_progress' as const, priority: 'high' as const, department: 'Highways', assigneeId: marcus.id, dueDate: '2026-06-15', description: 'Large pothole approx 30cm wide at junction with Maple Ave. Three vehicle damage reports received.' },
    { ref: 'LCI-002', title: 'Street lighting fault — Station Road (3 lamps out)', status: 'new' as const, priority: 'medium' as const, department: 'Highways', assigneeId: marcus.id, dueDate: '2026-06-20', description: null },
    { ref: 'LCI-003', title: 'Overgrown hedges blocking pavement on Elm Avenue', status: 'review' as const, priority: 'low' as const, department: 'Parks', assigneeId: lisa.id, dueDate: null, description: 'Resident complaint — hedge overhangs pavement forcing pedestrians into road.' },
    { ref: 'LCI-004', title: 'Housing benefit dispute — 14A Maple Close', status: 'escalated' as const, priority: 'high' as const, department: 'Housing', assigneeId: sarah.id, dueDate: '2026-06-10', description: 'Resident disputes benefit reduction decision. Legal representation involved.' },
    { ref: 'LCI-005', title: 'Fly-tipping behind Tesco Express, High Street', status: 'new' as const, priority: 'high' as const, department: 'Environmental Services', assigneeId: tom.id, dueDate: '2026-06-12', description: 'Large pile of household waste and furniture. Photos taken 2026-06-05.' },
    { ref: 'LCI-006', title: 'Planning application review — 22 Church Lane extension', status: 'review' as const, priority: 'medium' as const, department: 'Planning', assigneeId: priya.id, dueDate: '2026-06-25', description: 'Two-storey side extension proposal. Neighbour objections received.' },
    { ref: 'LCI-007', title: 'Noise complaint — Flat 3B Carlton House', status: 'in_progress' as const, priority: 'medium' as const, department: 'Housing', assigneeId: sarah.id, dueDate: null, description: 'Repeated complaints about late-night music. Warning letter issued 2026-05-28.' },
    { ref: 'LCI-008', title: 'Broken park bench — Victoria Gardens', status: 'resolved' as const, priority: 'low' as const, department: 'Parks', assigneeId: lisa.id, dueDate: null, description: 'Bench slats replaced and repainted.' },
    { ref: 'LCI-009', title: 'Water main leak — junction High St & Mill Lane', status: 'escalated' as const, priority: 'high' as const, department: 'Highways', assigneeId: marcus.id, dueDate: '2026-06-08', description: 'Thames Water notified. Road closure required. Ongoing.' },
    { ref: 'LCI-010', title: 'Council tax exemption appeal — Mr & Mrs Patel', status: 'awaiting' as const, priority: 'medium' as const, department: 'Housing', assigneeId: sarah.id, dueDate: null, description: 'Awaiting supporting documentation from applicants.' },
    { ref: 'LCI-011', title: 'Graffiti removal request — Bridgeway underpass', status: 'new' as const, priority: 'low' as const, department: 'Environmental Services', assigneeId: tom.id, dueDate: null, description: null },
    { ref: 'LCI-012', title: 'Tree surgery required — Oak Avenue (T1 listed tree)', status: 'review' as const, priority: 'medium' as const, department: 'Parks', assigneeId: lisa.id, dueDate: '2026-07-01', description: 'Arborist report commissioned. Dead branch risk.' },
    { ref: 'LCI-013', title: 'Planning enforcement — unauthorised rear extension', status: 'in_progress' as const, priority: 'high' as const, department: 'Planning', assigneeId: priya.id, dueDate: '2026-06-18', description: 'Extension built without consent at 7 Birch Road. Enforcement notice being drafted.' },
    { ref: 'LCI-014', title: 'Blue badge renewal — Mrs Thompson, 7 Rose Lane', status: 'awaiting' as const, priority: 'medium' as const, department: 'Housing', assigneeId: sarah.id, dueDate: '2026-06-30', description: 'Awaiting GP confirmation of ongoing mobility condition.' },
    { ref: 'LCI-015', title: 'Road markings faded — School Street pedestrian crossing', status: 'new' as const, priority: 'low' as const, department: 'Highways', assigneeId: null, dueDate: null, description: 'Zig-zag and stop line markings barely visible. School term resumes September.' },
    { ref: 'LCI-016', title: 'Abandoned vehicle — Elm Street car park', status: 'review' as const, priority: 'medium' as const, department: 'Environmental Services', assigneeId: tom.id, dueDate: null, description: 'Blue Ford Focus, no plates. DVLA check in progress.' },
  ]

  const inserted = await db.insert(tickets).values(ticketData).returning()

  await db.insert(boardOrder).values(
    inserted.map((t, i) => ({ ticketId: t.id, position: i }))
  )

  await db.insert(activityLog).values([
    { ticketId: inserted[0].id, action: 'moved to In Progress', actorName: 'Marcus Johnson', createdAt: new Date(Date.now() - 3_600_000) },
    { ticketId: inserted[3].id, action: 'escalated — legal involvement flagged', actorName: 'Sarah Chen', createdAt: new Date(Date.now() - 7_200_000) },
    { ticketId: inserted[7].id, action: 'resolved — bench repaired', actorName: 'Lisa Kim', createdAt: new Date(Date.now() - 86_400_000) },
    { ticketId: inserted[8].id, action: 'escalated — road closure authorised', actorName: 'Marcus Johnson', createdAt: new Date(Date.now() - 1_800_000) },
    { ticketId: inserted[6].id, action: 'assigned to Sarah Chen', actorName: 'Admin', createdAt: new Date(Date.now() - 10_800_000) },
  ])

  console.log(`✅ Seeded ${inserted.length} tickets, ${members.length} team members`)
  process.exit(0)
}

seed().catch((err) => { console.error(err); process.exit(1) })
