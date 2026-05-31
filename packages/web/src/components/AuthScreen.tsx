import { CalendarDays, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

type AuthMode = 'login' | 'register'

interface AuthScreenProps {
  isSubmitting: boolean
  errorMessage: string | null
  onLogin: (input: { email: string; password: string }) => Promise<void>
  onRegister: (input: { name: string; email: string; password: string }) => Promise<void>
}

export function AuthScreen({ isSubmitting, errorMessage, onLogin, onRegister }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length >= 8 &&
    (mode === 'login' || name.trim().length > 0)

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return

    if (mode === 'login') {
      await onLogin({
        email: email.trim(),
        password,
      })
      return
    }

    await onRegister({
      name: name.trim(),
      email: email.trim(),
      password,
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <CalendarDays size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Vocalendar</h1>
          <p className="mt-2 text-sm text-slate-500">连接真实后端后，从这里进入功能测试。</p>
        </div>

        <div className="mb-6 inline-flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => setMode('login')}
            type="button"
          >
            登录
          </button>
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => setMode('register')}
            type="button"
          >
            注册
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="authName">
                显示名称
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                id="authName"
                onChange={(event) => setName(event.target.value)}
                placeholder="输入您的名称"
                type="text"
                value={name}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="authEmail">
              邮箱
            </label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              id="authEmail"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="authPassword"
            >
              密码
            </label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              id="authPassword"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位"
              type="password"
              value={password}
            />
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:bg-slate-300"
            disabled={!canSubmit || isSubmitting}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {isSubmitting ? <LoaderCircle className="animate-spin" size={16} /> : null}
            {mode === 'login' ? '登录并进入' : '注册并进入'}
          </button>
        </div>
      </div>
    </div>
  )
}
