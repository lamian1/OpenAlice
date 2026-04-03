import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, type AppConfig } from '../api'
import { Toggle } from '../components/Toggle'
import { SaveIndicator } from '../components/SaveIndicator'
import { ConfigSection, Field, inputClass } from '../components/form'
import { useAutoSave } from '../hooks/useAutoSave'
import { PageHeader } from '../components/PageHeader'
import { PageLoading } from '../components/StateViews'
import { useI18n } from '../i18n'

export function SettingsPage() {
  const { text } = useI18n()
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    api.config.load().then(setConfig).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title={text('设置', 'Settings')} />

      {config ? (
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-[880px] mx-auto">
            {/* Agent */}
            <ConfigSection title={text('智能体', 'Agent')} description={text('控制 AI 的文件系统与工具权限。改动会在下一次请求时生效。', 'Control the AI file-system and tool permissions. Changes apply on the next request.')}>
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex-1">
                  <span className="text-sm font-medium text-text">
                    {text('进化模式', 'Evolution mode')}
                  </span>
                  <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                    {config.agent?.evolutionMode
                      ? text('可访问整个项目，AI 可以修改源代码', 'Full-project access. The AI can modify source code.')
                      : text('沙箱模式，AI 只能编辑 data/brain/', 'Sandbox mode. The AI can only edit data/brain/.')}
                  </p>
                </div>
                <Toggle
                  checked={config.agent?.evolutionMode || false}
                  onChange={async (v) => {
                    try {
                      await api.config.updateSection('agent', { ...config.agent, evolutionMode: v })
                      setConfig((c) => c ? { ...c, agent: { ...c.agent, evolutionMode: v } } : c)
                    } catch {
                      // Toggle doesn't flip on failure
                    }
                  }}
                />
              </div>
            </ConfigSection>

            {/* Compaction */}
            <ConfigSection title={text('上下文压缩', 'Context compaction')} description={text('管理上下文窗口。当对话接近“最大上下文 - 最大输出”上限时，旧消息会被自动总结以释放空间。', 'Manage the context window. When a conversation approaches the “max context - max output” limit, older messages are summarized automatically to free space.')}>
              <CompactionForm config={config} />
            </ConfigSection>
          </div>
      </div>
      ) : (
        <PageLoading />
      )}
    </div>
  )
}

// ==================== Form Sections ====================

function CompactionForm({ config }: { config: AppConfig }) {
  const { text } = useI18n()
  const [ctx, setCtx] = useState(String(config.compaction?.maxContextTokens || ''))
  const [out, setOut] = useState(String(config.compaction?.maxOutputTokens || ''))

  const data = useMemo(
    () => ({ maxContextTokens: Number(ctx), maxOutputTokens: Number(out) }),
    [ctx, out],
  )

  const save = useCallback(async (d: { maxContextTokens: number; maxOutputTokens: number }) => {
    await api.config.updateSection('compaction', d)
  }, [])

  const { status, retry } = useAutoSave({ data, save })

  return (
    <>
      <Field label={text('最大上下文 Token', 'Max context tokens')}>
        <input className={inputClass} type="number" step={1000} value={ctx} onChange={(e) => setCtx(e.target.value)} />
      </Field>
      <Field label={text('最大输出 Token', 'Max output tokens')}>
        <input className={inputClass} type="number" step={1000} value={out} onChange={(e) => setOut(e.target.value)} />
      </Field>
      <SaveIndicator status={status} onRetry={retry} />
    </>
  )
}

