import { Pool } from 'pg'

// Единый пул соединений для всего приложения
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
  
  // Удобная обёртка для получения одной строки
  queryOne: async <T>(text: string, params?: unknown[]): Promise<T | null> => {
    const result = await pool.query(text, params)
    return result.rows[0] ?? null
  },

  // Удобная обёртка для получения списка
  queryMany: async <T>(text: string, params?: unknown[]): Promise<T[]> => {
    const result = await pool.query(text, params)
    return result.rows
  },
}

export default pool
