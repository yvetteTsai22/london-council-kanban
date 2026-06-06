'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './sidebar.module.css'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/board', label: 'Kanban Board', icon: '☰' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>LC</div>
        <div className={styles.logoText}>
          Issue Tracker
          <span>London Borough Council</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navLabel}>Menu</div>
        {navItems.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${pathname === href ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className={styles.footer}>
        London Council © 2026
      </div>
    </aside>
  )
}
