import {
  pgTable, pgEnum, serial, text, integer, date, timestamp
} from 'drizzle-orm/pg-core'

export const statusEnum = pgEnum('ticket_status', [
  'new', 'review', 'in_progress', 'escalated', 'resolved', 'awaiting',
])

export const priorityEnum = pgEnum('ticket_priority', ['high', 'medium', 'low'])

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull(),
})

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  ref: text('ref').unique().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: statusEnum('status').notNull().default('new'),
  priority: priorityEnum('priority').notNull().default('medium'),
  department: text('department').notNull(),
  assigneeId: integer('assignee_id').references(() => teamMembers.id),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  action: text('action').notNull(),
  actorName: text('actor_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const boardOrder = pgTable('board_order', {
  ticketId: integer('ticket_id').primaryKey().references(() => tickets.id),
  position: integer('position').notNull(),
})

export type TicketStatus = typeof statusEnum.enumValues[number]
export type TicketPriority = typeof priorityEnum.enumValues[number]
export type Ticket = typeof tickets.$inferSelect
export type TeamMember = typeof teamMembers.$inferSelect
export type Comment = typeof comments.$inferSelect
export type ActivityEntry = typeof activityLog.$inferSelect
